import { Client } from "mysql";
import { Table, TableStatus } from "../../domain/Table.ts";
import { TableRepository, TableSummaryDTO } from "../../domain/TableRepository.ts";
import { transactionManager } from "../../../../shared/infrastructure/database.ts";

export class MySQLTableRepository implements TableRepository {
  constructor(private readonly client: Client) {}

  private mapRowToTable(row: any): Table {
    // Parsear el número físico (1 al 7) desde table_number (ej. "MESA 1")
    const match = String(row.table_number).match(/\d+/);
    const parsedNumber = match ? parseInt(match[0], 10) : Number(row.id);
    const number = Math.min(Math.max(parsedNumber, 1), 7);
    const name = `MESA ${number}`;

    const rawStatus = String(row.status).toUpperCase();
    const status: TableStatus = rawStatus === "OCUPADA" || rawStatus === "OCCUPIED" ? "OCUPADA" : "LIBRE";
    const accountRequested = Boolean(row.account_requested);
    const createdAt = row.created_at ? new Date(row.created_at) : new Date();
    const updatedAt = row.updated_at ? new Date(row.updated_at) : new Date();

    return new Table(
      Number(row.id),
      number,
      name,
      status,
      accountRequested,
      createdAt,
      updatedAt
    );
  }

  async findAll(): Promise<Table[]> {
    const rows = await this.client.query(
      `SELECT id, table_number, status, account_requested, created_at, updated_at
       FROM \`tables\`
       WHERE \`table_number\` LIKE 'MESA %'
       ORDER BY CAST(SUBSTRING(\`table_number\`, 6) AS UNSIGNED) ASC, id ASC
       LIMIT 7`
    );

    return rows.map((r: any) => this.mapRowToTable(r));
  }

  async findAllWithSummary(): Promise<TableSummaryDTO[]> {
    const rows = await this.client.query(
      `SELECT 
         t.id, 
         t.table_number, 
         t.status, 
         t.account_requested, 
         t.created_at, 
         t.updated_at,
         COUNT(CASE WHEN o.id IS NOT NULL AND o.status != 'CANCELADO' AND o.paid_at IS NULL THEN 1 END) as active_orders_count,
         COALESCE(SUM(CASE WHEN o.id IS NOT NULL AND o.status != 'CANCELADO' AND o.paid_at IS NULL THEN o.total ELSE 0 END), 0) as total_pending_amount
       FROM \`tables\` t
       LEFT JOIN \`orders\` o ON o.table_id = t.id
       WHERE t.table_number LIKE 'MESA %'
       GROUP BY t.id, t.table_number, t.status, t.account_requested, t.created_at, t.updated_at
       ORDER BY CAST(SUBSTRING(t.table_number, 6) AS UNSIGNED) ASC, t.id ASC
       LIMIT 7`
    );

    return rows.map((r: any) => ({
      table: this.mapRowToTable(r),
      activeOrdersCount: Number(r.active_orders_count || 0),
      totalPendingAmount: Number(r.total_pending_amount || 0),
    }));
  }

  async findById(id: number): Promise<Table | null> {
    const rows = await this.client.query(
      `SELECT id, table_number, status, account_requested, created_at, updated_at
       FROM \`tables\`
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return null;
    return this.mapRowToTable(rows[0]);
  }

  async findByNumber(number: number): Promise<Table | null> {
    const tableName = `MESA ${number}`;
    const rows = await this.client.query(
      `SELECT id, table_number, status, account_requested, created_at, updated_at
       FROM \`tables\`
       WHERE \`table_number\` = ?
       LIMIT 1`,
      [tableName]
    );

    if (rows.length === 0) return null;
    return this.mapRowToTable(rows[0]);
  }

  async updateStatus(id: number, status: TableStatus): Promise<void> {
    await this.client.query(
      `UPDATE \`tables\`
       SET \`status\` = ?, \`updated_at\` = NOW()
       WHERE id = ?`,
      [status, id]
    );
  }

  async updateAccountRequested(id: number, requested: boolean): Promise<void> {
    await this.client.query(
      `UPDATE \`tables\`
       SET \`account_requested\` = ?, \`updated_at\` = NOW()
       WHERE id = ?`,
      [requested ? 1 : 0, id]
    );
  }

  async countPendingOrders(tableId: number): Promise<number> {
    const rows = await this.client.query(
      `SELECT COUNT(*) as cnt
       FROM \`orders\`
       WHERE \`table_id\` = ? AND \`status\` != 'CANCELADO' AND \`paid_at\` IS NULL`,
      [tableId]
    );

    return Number(rows[0]?.cnt || 0);
  }

  async transferOrders(sourceTableId: number, targetTableId: number): Promise<void> {
    await transactionManager.runInTransaction(async (exec) => {
      // 1. Mover pedidos activos de sourceTableId a targetTableId
      await exec.query(
        `UPDATE \`orders\`
         SET \`table_id\` = ?
         WHERE \`table_id\` = ? AND \`status\` != 'CANCELADO' AND \`paid_at\` IS NULL`,
        [targetTableId, sourceTableId]
      );

      // 2. Liberar mesa origen
      await exec.query(
        `UPDATE \`tables\`
         SET \`status\` = 'LIBRE', \`account_requested\` = 0, \`updated_at\` = NOW()
         WHERE id = ?`,
        [sourceTableId]
      );

      // 3. Ocupar mesa destino
      await exec.query(
        `UPDATE \`tables\`
         SET \`status\` = 'OCUPADA', \`updated_at\` = NOW()
         WHERE id = ?`,
        [targetTableId]
      );
    });
  }
}

import { CashSession } from "../../domain/CashSession.ts";
import { CashSessionRepository, CashSessionFilters } from "../../domain/CashSessionRepository.ts";
import { CashSessionStatus } from "../../domain/value-objects/CashSessionStatus.ts";
import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

export class MySQLCashSessionRepository implements CashSessionRepository {
  async save(session: CashSession, dbExecutor?: QueryExecutor): Promise<CashSession> {
    const exec = dbExecutor || client;
    const openedAtFormatted = session.openedAt
      ? session.openedAt.toISOString().slice(0, 19).replace("T", " ")
      : new Date().toISOString().slice(0, 19).replace("T", " ");

    const closedAtFormatted = session.closedAt
      ? session.closedAt.toISOString().slice(0, 19).replace("T", " ")
      : null;

    const result = await exec.execute(
      `INSERT INTO cash_sessions (
        opened_by_user_id, closed_by_user_id, register_id, status,
        opening_balance, closing_balance_expected, closing_balance_real,
        discrepancy_amount, notes, discrepancy_notes, opened_at, closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.openedByUserId,
        session.closedByUserId,
        session.registerId,
        session.status.value,
        session.openingBalance,
        session.closingBalanceExpected,
        session.closingBalanceReal,
        session.discrepancyAmount,
        session.notes,
        session.discrepancyNotes,
        openedAtFormatted,
        closedAtFormatted,
      ]
    );

    const insertedId = result.lastInsertId!;

    return new CashSession(
      insertedId,
      session.openedByUserId,
      session.closedByUserId,
      session.registerId,
      session.status,
      session.openingBalance,
      session.closingBalanceExpected,
      session.closingBalanceReal,
      session.discrepancyAmount,
      session.notes,
      session.discrepancyNotes,
      session.openedAt ?? new Date(),
      session.closedAt
    );
  }

  async update(session: CashSession, dbExecutor?: QueryExecutor): Promise<CashSession> {
    const exec = dbExecutor || client;
    if (session.id === null) {
      throw new Error("No se puede actualizar una sesión sin ID");
    }

    const closedAtFormatted = session.closedAt
      ? session.closedAt.toISOString().slice(0, 19).replace("T", " ")
      : null;

    await exec.execute(
      `UPDATE cash_sessions SET
        closed_by_user_id = ?,
        status = ?,
        closing_balance_expected = ?,
        closing_balance_real = ?,
        discrepancy_amount = ?,
        discrepancy_notes = ?,
        closed_at = ?
      WHERE id = ?`,
      [
        session.closedByUserId,
        session.status.value,
        session.closingBalanceExpected,
        session.closingBalanceReal,
        session.discrepancyAmount,
        session.discrepancyNotes,
        closedAtFormatted,
        session.id,
      ]
    );

    return session;
  }

  async findById(id: number, dbExecutor?: QueryExecutor): Promise<CashSession | null> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      `SELECT cs.id, cs.opened_by_user_id, cs.closed_by_user_id, cs.register_id, cs.status,
              cs.opening_balance, cs.closing_balance_expected, cs.closing_balance_real,
              cs.discrepancy_amount, cs.notes, cs.discrepancy_notes, cs.opened_at, cs.closed_at,
              COALESCE(NULLIF(TRIM(u.full_name), ''), u.username, CONCAT('Usuario #', cs.opened_by_user_id)) AS opened_by_user_name
       FROM cash_sessions cs
       LEFT JOIN users u ON u.id = cs.opened_by_user_id
       WHERE cs.id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findActiveByRegisterId(registerId: number, dbExecutor?: QueryExecutor): Promise<CashSession | null> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      `SELECT cs.id, cs.opened_by_user_id, cs.closed_by_user_id, cs.register_id, cs.status,
              cs.opening_balance, cs.closing_balance_expected, cs.closing_balance_real,
              cs.discrepancy_amount, cs.notes, cs.discrepancy_notes, cs.opened_at, cs.closed_at,
              COALESCE(NULLIF(TRIM(u.full_name), ''), u.username, CONCAT('Usuario #', cs.opened_by_user_id)) AS opened_by_user_name
       FROM cash_sessions cs
       LEFT JOIN users u ON u.id = cs.opened_by_user_id
       WHERE cs.register_id = ? AND cs.status = 'OPEN' LIMIT 1`,
      [registerId]
    );
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findActiveByUserId(userId: number, dbExecutor?: QueryExecutor): Promise<CashSession | null> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      `SELECT cs.id, cs.opened_by_user_id, cs.closed_by_user_id, cs.register_id, cs.status,
              cs.opening_balance, cs.closing_balance_expected, cs.closing_balance_real,
              cs.discrepancy_amount, cs.notes, cs.discrepancy_notes, cs.opened_at, cs.closed_at,
              COALESCE(NULLIF(TRIM(u.full_name), ''), u.username, CONCAT('Usuario #', cs.opened_by_user_id)) AS opened_by_user_name
       FROM cash_sessions cs
       LEFT JOIN users u ON u.id = cs.opened_by_user_id
       WHERE cs.opened_by_user_id = ? AND cs.status = 'OPEN' LIMIT 1`,
      [userId]
    );
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findAll(filters?: CashSessionFilters, dbExecutor?: QueryExecutor): Promise<CashSession[]> {
    const exec = dbExecutor || client;
    let query = `SELECT cs.id, cs.opened_by_user_id, cs.closed_by_user_id, cs.register_id, cs.status,
                        cs.opening_balance, cs.closing_balance_expected, cs.closing_balance_real,
                        cs.discrepancy_amount, cs.notes, cs.discrepancy_notes, cs.opened_at, cs.closed_at,
                        COALESCE(NULLIF(TRIM(u.full_name), ''), u.username, CONCAT('Usuario #', cs.opened_by_user_id)) AS opened_by_user_name
                 FROM cash_sessions cs
                 LEFT JOIN users u ON u.id = cs.opened_by_user_id
                 WHERE 1=1`;
    const params: any[] = [];

    if (filters?.registerId) {
      query += " AND cs.register_id = ?";
      params.push(filters.registerId);
    }
    if (filters?.openedByUserId) {
      query += " AND cs.opened_by_user_id = ?";
      params.push(filters.openedByUserId);
    }
    if (filters?.status) {
      query += " AND cs.status = ?";
      params.push(filters.status);
    }

    query += " ORDER BY cs.opened_at DESC";

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const rows = await exec.query(query, params);
    return rows.map((row: any) => this.mapToDomain(row));
  }

  private mapToDomain(row: any): CashSession {
    return new CashSession(
      row.id,
      row.opened_by_user_id,
      row.closed_by_user_id ?? null,
      row.register_id,
      CashSessionStatus.create(row.status),
      Number(row.opening_balance),
      Number(row.closing_balance_expected),
      Number(row.closing_balance_real),
      Number(row.discrepancy_amount),
      row.notes ?? null,
      row.discrepancy_notes ?? null,
      row.opened_at ? new Date(row.opened_at) : null,
      row.closed_at ? new Date(row.closed_at) : null,
      row.opened_by_user_name ?? null
    );
  }
}

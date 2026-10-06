import { InventoryItem } from "../../domain/InventoryItem.ts";
import { InventoryItemRepository } from "../../domain/InventoryItemRepository.ts";
import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

export class MySQLInventoryItemRepository implements InventoryItemRepository {
  async findAll(activeOnly: boolean = true, dbExecutor?: QueryExecutor): Promise<InventoryItem[]> {
    const exec = dbExecutor || client;
    let query = `
      SELECT id, name, unit, current_stock, min_stock, max_stock, cost_per_unit, supplier, is_active
      FROM inventory_items
    `;
    if (activeOnly) {
      query += ` WHERE is_active = 1`;
    }
    query += ` ORDER BY name ASC`;

    const rows = await exec.query(query);
    return rows.map((row: any) => this.mapToDomain(row));
  }

  async findById(id: number, dbExecutor?: QueryExecutor): Promise<InventoryItem | null> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      `SELECT id, name, unit, current_stock, min_stock, max_stock, cost_per_unit, supplier, is_active
       FROM inventory_items WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!rows || rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findLowStock(dbExecutor?: QueryExecutor): Promise<InventoryItem[]> {
    const exec = dbExecutor || client;
    const query = `
      SELECT id, name, unit, current_stock, min_stock, max_stock, cost_per_unit, supplier, is_active
      FROM inventory_items
      WHERE is_active = 1 AND current_stock <= min_stock
      ORDER BY (current_stock / min_stock) ASC, name ASC
    `;
    const rows = await exec.query(query);
    return rows.map((row: any) => this.mapToDomain(row));
  }

  async updateStock(id: number, newStock: number, dbExecutor?: QueryExecutor): Promise<void> {
    const exec = dbExecutor || client;
    await exec.execute(
      `UPDATE inventory_items SET current_stock = ? WHERE id = ?`,
      [newStock, id]
    );
  }

  private mapToDomain(row: any): InventoryItem {
    return new InventoryItem(
      Number(row.id),
      row.name,
      row.unit,
      Number(row.current_stock),
      Number(row.min_stock),
      row.max_stock !== null ? Number(row.max_stock) : null,
      Number(row.cost_per_unit),
      row.supplier || null,
      row.is_active === 1
    );
  }
}

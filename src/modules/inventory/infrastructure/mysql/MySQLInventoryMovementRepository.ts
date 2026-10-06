import { InventoryMovement } from "../../domain/InventoryMovement.ts";
import { InventoryMovementRepository } from "../../domain/InventoryMovementRepository.ts";
import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

export class MySQLInventoryMovementRepository implements InventoryMovementRepository {
  async save(
    movement: Omit<InventoryMovement, 'id' | 'createdAt'>,
    dbExecutor?: QueryExecutor
  ): Promise<InventoryMovement> {
    const exec = dbExecutor || client;
    const result = await exec.execute(
      `INSERT INTO inventory_movements 
       (item_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, performed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movement.itemId,
        movement.movementType,
        movement.quantity,
        movement.unitCost ?? null,
        movement.referenceType,
        movement.referenceId ?? null,
        movement.notes ?? null,
        movement.performedBy,
      ]
    );

    const insertedId = result.lastInsertId!;
    // Fetch inserted record with item name
    const rows = await exec.query(
      `SELECT m.id, m.item_id, m.movement_type, m.quantity, m.unit_cost, 
              m.reference_type, m.reference_id, m.notes, m.performed_by, m.created_at,
              i.name AS item_name
       FROM inventory_movements m
       JOIN inventory_items i ON m.item_id = i.id
       WHERE m.id = ? LIMIT 1`,
      [insertedId]
    );

    if (rows && rows.length > 0) {
      return this.mapToDomain(rows[0]);
    }

    return new InventoryMovement(
      insertedId,
      movement.itemId,
      movement.movementType,
      movement.quantity,
      movement.unitCost ?? null,
      movement.referenceType,
      movement.referenceId ?? null,
      movement.notes ?? null,
      movement.performedBy,
      new Date(),
      movement.itemName
    );
  }

  async findAll(limit: number = 50, dbExecutor?: QueryExecutor): Promise<InventoryMovement[]> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      `SELECT m.id, m.item_id, m.movement_type, m.quantity, m.unit_cost, 
              m.reference_type, m.reference_id, m.notes, m.performed_by, m.created_at,
              i.name AS item_name
       FROM inventory_movements m
       JOIN inventory_items i ON m.item_id = i.id
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map((row: any) => this.mapToDomain(row));
  }

  async findByItemId(itemId: number, limit: number = 50, dbExecutor?: QueryExecutor): Promise<InventoryMovement[]> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      `SELECT m.id, m.item_id, m.movement_type, m.quantity, m.unit_cost, 
              m.reference_type, m.reference_id, m.notes, m.performed_by, m.created_at,
              i.name AS item_name
       FROM inventory_movements m
       JOIN inventory_items i ON m.item_id = i.id
       WHERE m.item_id = ?
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ?`,
      [itemId, limit]
    );
    return rows.map((row: any) => this.mapToDomain(row));
  }

  private mapToDomain(row: any): InventoryMovement {
    return new InventoryMovement(
      Number(row.id),
      Number(row.item_id),
      row.movement_type,
      Number(row.quantity),
      row.unit_cost !== null ? Number(row.unit_cost) : null,
      row.reference_type,
      row.reference_id !== null ? Number(row.reference_id) : null,
      row.notes || null,
      Number(row.performed_by),
      new Date(row.created_at),
      row.item_name || undefined
    );
  }
}

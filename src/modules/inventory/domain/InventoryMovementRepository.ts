import { InventoryMovement } from "./InventoryMovement.ts";
import { QueryExecutor } from "../../../shared/infrastructure/database.ts";

export interface InventoryMovementRepository {
  save(movement: Omit<InventoryMovement, 'id' | 'createdAt'>, dbExecutor?: QueryExecutor): Promise<InventoryMovement>;
  findAll(limit?: number, dbExecutor?: QueryExecutor): Promise<InventoryMovement[]>;
  findByItemId(itemId: number, limit?: number, dbExecutor?: QueryExecutor): Promise<InventoryMovement[]>;
}

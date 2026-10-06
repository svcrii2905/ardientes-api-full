import { InventoryItem } from "./InventoryItem.ts";
import { QueryExecutor } from "../../../shared/infrastructure/database.ts";

export interface InventoryItemRepository {
  findAll(activeOnly?: boolean, dbExecutor?: QueryExecutor): Promise<InventoryItem[]>;
  findById(id: number, dbExecutor?: QueryExecutor): Promise<InventoryItem | null>;
  findLowStock(dbExecutor?: QueryExecutor): Promise<InventoryItem[]>;
  updateStock(id: number, newStock: number, dbExecutor?: QueryExecutor): Promise<void>;
}

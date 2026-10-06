import { MySQLInventoryItemRepository } from "./mysql/MySQLInventoryItemRepository.ts";
import { MySQLInventoryMovementRepository } from "./mysql/MySQLInventoryMovementRepository.ts";
import { ListInventoryItemsUseCase } from "../application/use-cases/ListInventoryItemsUseCase.ts";
import { GetLowStockItemsUseCase } from "../application/use-cases/GetLowStockItemsUseCase.ts";
import { RegisterMovementUseCase } from "../application/use-cases/RegisterMovementUseCase.ts";
import { ListMovementsUseCase } from "../application/use-cases/ListMovementsUseCase.ts";
import { InventoryController } from "./http/InventoryController.ts";
import { transactionManager } from "../../../shared/infrastructure/database.ts";

export const inventoryItemRepository = new MySQLInventoryItemRepository();
export const inventoryMovementRepository = new MySQLInventoryMovementRepository();

export const listInventoryItemsUseCase = new ListInventoryItemsUseCase(inventoryItemRepository);
export const getLowStockItemsUseCase = new GetLowStockItemsUseCase(inventoryItemRepository);
export const registerMovementUseCase = new RegisterMovementUseCase(
  inventoryItemRepository,
  inventoryMovementRepository,
  transactionManager
);
export const listMovementsUseCase = new ListMovementsUseCase(inventoryMovementRepository);

export const inventoryController = new InventoryController(
  listInventoryItemsUseCase,
  getLowStockItemsUseCase,
  registerMovementUseCase,
  listMovementsUseCase
);

export const inventoryDependencies = {
  inventoryController,
  inventoryItemRepository,
  inventoryMovementRepository,
};

import { Router } from "oak";
import { inventoryDependencies } from "../dependencies.ts";
import { authMiddleware } from "../../../../shared/infrastructure/middleware/auth.middleware.ts";
import { requirePermission } from "../../../../shared/infrastructure/middleware/authorize.middleware.ts";

const inventoryRouter = new Router({ prefix: "/api/v1/inventory" });
const { inventoryController } = inventoryDependencies;

// Listar insumos de inventario
inventoryRouter.get(
  "/items",
  authMiddleware,
  requirePermission("inventory:read"),
  (ctx) => inventoryController.getItems(ctx)
);

// Obtener alertas de insumos con stock bajo o agotado
inventoryRouter.get(
  "/items/low-stock",
  authMiddleware,
  requirePermission("inventory:read"),
  (ctx) => inventoryController.getLowStockItems(ctx)
);

// Registrar movimiento de inventario (Entrada, Salida, Ajuste, Merma)
inventoryRouter.post(
  "/movements",
  authMiddleware,
  requirePermission("inventory:adjust"),
  (ctx) => inventoryController.registerMovement(ctx)
);

// Historial de movimientos de inventario
inventoryRouter.get(
  "/movements",
  authMiddleware,
  requirePermission("inventory:read"),
  (ctx) => inventoryController.getMovements(ctx)
);

export { inventoryRouter };

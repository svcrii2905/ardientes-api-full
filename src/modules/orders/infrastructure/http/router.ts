import { Router } from "oak";
import { ordersDependencies } from "../dependencies.ts";
import { authMiddleware } from "../../../../shared/infrastructure/middleware/auth.middleware.ts";
import { requirePermission } from "../../../../shared/infrastructure/middleware/authorize.middleware.ts";

const ordersRouter = new Router({ prefix: "/api/v1/orders" });

const { orderController } = ordersDependencies;

// Listar pedidos con filtros opcionales
ordersRouter.get(
  "/",
  authMiddleware,
  requirePermission("orders:create", "orders:update_status", "reports:read", "tables:read"),
  (ctx) => orderController.listAll(ctx)
);

// Crear un nuevo pedido (MESA, RECOGER o DOMICILIO)
ordersRouter.post(
  "/",
  authMiddleware,
  requirePermission("orders:create"),
  (ctx) => orderController.create(ctx)
);

// Obtener pedidos activos para la pantalla de cocina (KDS)
ordersRouter.get(
  "/kitchen",
  authMiddleware,
  requirePermission("orders:update_status"),
  (ctx) => orderController.getKitchenOrders(ctx)
);

// Obtener un pedido por ID (con ítems, bebidas, combos y toppings)
ordersRouter.get(
  "/:id",
  authMiddleware,
  requirePermission("orders:create", "orders:update_status", "reports:read", "tables:orders"),
  (ctx) => orderController.findById(ctx as any)
);

// Cambiar el estado de un pedido (EN_PREPARACION, LISTO, ENTREGADO, etc.)
ordersRouter.patch(
  "/:id/status",
  authMiddleware,
  requirePermission("orders:update_status"),
  (ctx) => orderController.changeStatus(ctx as any)
);

// Cancelar un pedido (requiere motivo en el body)
ordersRouter.patch(
  "/:id/cancel",
  authMiddleware,
  requirePermission("orders:cancel"),
  (ctx) => orderController.cancel(ctx as any)
);

// Despachar pedido DOMICILIO a domiciliario
// MVP: Protegido con payments:manage para limitar a CAJERO y SUPERVISOR
ordersRouter.patch(
  "/:id/dispatch",
  authMiddleware,
  requirePermission("payments:manage"),
  (ctx) => orderController.dispatchDeliveryOrder(ctx as any)
);

export { ordersRouter };

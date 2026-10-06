import { Router } from "oak";
import { paymentsDependencies } from "../dependencies.ts";
import { authMiddleware } from "../../../../shared/infrastructure/middleware/auth.middleware.ts";
import { requirePermission } from "../../../../shared/infrastructure/middleware/authorize.middleware.ts";

const paymentsRouter = new Router({ prefix: "/api/v1/payments" });

const { paymentController } = paymentsDependencies;

// Listar métodos de pago activos (Efectivo, Tarjetas, Nequi, Daviplata, etc.)
paymentsRouter.get(
  "/methods",
  authMiddleware,
  (ctx) => paymentController.listMethods(ctx)
);

// Registrar un nuevo pago (soporta pagos parciales o mixtos)
paymentsRouter.post(
  "/",
  authMiddleware,
  requirePermission("payments:manage"),
  (ctx) => paymentController.processPayment(ctx)
);

// Obtener todos los pagos de un pedido específico y resumen de saldos
paymentsRouter.get(
  "/order/:orderId",
  authMiddleware,
  requirePermission("payments:manage", "orders:create", "tables:orders"),
  (ctx) => paymentController.getPaymentsByOrder(ctx as any)
);

// Revertir un pago en caso de error o devolución
paymentsRouter.patch(
  "/:id/revert",
  authMiddleware,
  requirePermission("payments:manage"),
  (ctx) => paymentController.revertPayment(ctx as any)
);

export { paymentsRouter };

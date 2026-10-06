import { Router } from "oak";
import { cashRegisterDependencies } from "../dependencies.ts";
import { authMiddleware } from "../../../../shared/infrastructure/middleware/auth.middleware.ts";
import { requirePermission } from "../../../../shared/infrastructure/middleware/authorize.middleware.ts";

const cashRegisterRouter = new Router({ prefix: "/api/v1/cash-registers" });

const { cashRegisterController } = cashRegisterDependencies;

// Abrir turno/sesión de caja
cashRegisterRouter.post(
  "/sessions/open",
  authMiddleware,
  requirePermission("cash_session:open"),
  (ctx) => cashRegisterController.openSession(ctx)
);

// Cerrar turno/sesión de caja (arqueo)
cashRegisterRouter.post(
  "/sessions/:id/close",
  authMiddleware,
  requirePermission("cash_session:close"),
  (ctx) => cashRegisterController.closeSession(ctx as any)
);

// Obtener sesión activa por caja o usuario
cashRegisterRouter.get(
  "/sessions/active",
  authMiddleware,
  requirePermission("cash_session:open", "cash_session:close", "payments:manage", "orders:create"),
  (ctx) => cashRegisterController.getActiveSession(ctx)
);

// Listar todas las sesiones
cashRegisterRouter.get(
  "/sessions",
  authMiddleware,
  requirePermission("cash_session:close", "reports:read"),
  (ctx) => cashRegisterController.listSessions(ctx)
);

// Registrar movimiento (entrada/salida de efectivo)
cashRegisterRouter.post(
  "/sessions/:id/transactions",
  authMiddleware,
  requirePermission("cash_session:open", "cash_session:close", "payments:manage"),
  (ctx) => cashRegisterController.createTransaction(ctx as any)
);

// Listar movimientos de una sesión
cashRegisterRouter.get(
  "/sessions/:id/transactions",
  authMiddleware,
  requirePermission("cash_session:open", "cash_session:close", "reports:read"),
  (ctx) => cashRegisterController.listTransactions(ctx as any)
);

export { cashRegisterRouter };

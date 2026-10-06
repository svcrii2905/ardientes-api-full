import { Router } from "oak";
import { tableController } from "../dependencies.ts";
import { authMiddleware } from "../../../../shared/infrastructure/middleware/auth.middleware.ts";
import { requirePermission } from "../../../../shared/infrastructure/middleware/authorize.middleware.ts";

export const tablesRouter = new Router({ prefix: "/api/v1/tables" });

tablesRouter
  .get("/", authMiddleware, requirePermission("tables:read"), (ctx) => tableController.getTables(ctx))
  .get("/:id", authMiddleware, requirePermission("tables:read"), (ctx) => tableController.getTableById(ctx))
  .get("/:id/orders", authMiddleware, requirePermission("tables:read", "tables:orders"), (ctx) => tableController.getTableOrders(ctx))
  .post("/:id/orders", authMiddleware, requirePermission("tables:orders"), (ctx) => tableController.createTableOrder(ctx))
  .post("/:id/request-bill", authMiddleware, requirePermission("tables:request_bill"), (ctx) => tableController.requestBill(ctx))
  .post("/:id/release", authMiddleware, requirePermission("tables:request_bill", "payments:manage", "cash_session:close"), (ctx) => tableController.releaseTable(ctx))
  .post("/:id/transfer", authMiddleware, requirePermission("tables:transfer"), (ctx) => tableController.transferTable(ctx));

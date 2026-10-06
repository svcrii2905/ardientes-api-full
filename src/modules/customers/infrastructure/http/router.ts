import { Router } from "oak";
import { customerController } from "../dependencies.ts";
import { authMiddleware } from "../../../../shared/infrastructure/middleware/auth.middleware.ts";
import { requirePermission } from "../../../../shared/infrastructure/middleware/authorize.middleware.ts";

export const customersRouter = new Router({ prefix: "/api/v1/customers" });

customersRouter
  .get("/", authMiddleware, requirePermission("customers:manage", "orders:create", "tables:read"), (ctx) => customerController.search(ctx))
  .post("/", authMiddleware, requirePermission("customers:manage"), (ctx) => customerController.create(ctx))
  .get("/by-phone/:phone", authMiddleware, requirePermission("customers:manage", "orders:create", "tables:read"), (ctx) => customerController.findByPhone(ctx))
  .get("/:id", authMiddleware, requirePermission("customers:manage", "orders:create"), (ctx) => customerController.findById(ctx))
  .get("/:id/loyalty", authMiddleware, requirePermission("customers:manage", "orders:create"), (ctx) => customerController.getLoyalty(ctx))
  .post("/:id/redeem", authMiddleware, requirePermission("customers:manage"), (ctx) => customerController.redeem(ctx))
  .post("/:id/activation-code", authMiddleware, requirePermission("customers:manage"), (ctx) => customerController.generateActivationCode(ctx));


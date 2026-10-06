import { Router } from "oak";
import { authDependencies } from "../dependencies.ts";
import { authMiddleware } from "../../../../shared/infrastructure/middleware/auth.middleware.ts";
import { requirePermission } from "../../../../shared/infrastructure/middleware/authorize.middleware.ts";

const usersRouter = new Router({ prefix: "/api/v1/users" });

const { userController } = authDependencies;

// Obtener domiciliarios disponibles (Caja)
usersRouter.get(
  "/drivers",
  authMiddleware,
  requirePermission("payments:manage"),
  (ctx) => userController.getDrivers(ctx)
);

export { usersRouter };

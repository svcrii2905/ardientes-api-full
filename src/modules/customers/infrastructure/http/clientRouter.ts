import { Router } from "oak";
import { customerAuthController } from "../dependencies.ts";
import { customerAuthMiddleware } from "../../../../shared/infrastructure/middleware/customerAuth.middleware.ts";
import { clientActivationRateLimitMiddleware } from "../../../../shared/infrastructure/middleware/clientActivationRateLimit.middleware.ts";

export const clientRouter = new Router({ prefix: "/api/v1/client" });

// Registro e inicio de sesión de clientes (portal autoservicio)
clientRouter.post("/register", (ctx) => customerAuthController.register(ctx));
clientRouter.post("/login", (ctx) => customerAuthController.login(ctx));

// Activación de cliente existente de Caja con código temporal
clientRouter.post("/activate", clientActivationRateLimitMiddleware, (ctx) => customerAuthController.activate(ctx));

// Perfil del cliente autenticado (protegido por customerAuthMiddleware)
clientRouter.get("/me", customerAuthMiddleware, (ctx) => customerAuthController.getMe(ctx));


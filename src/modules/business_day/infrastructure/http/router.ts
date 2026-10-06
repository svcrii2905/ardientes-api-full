import { Router } from "oak";
import { businessDayController } from "../dependencies.ts";
import { authMiddleware } from "../../../../shared/infrastructure/middleware/auth.middleware.ts";
import { requirePermission } from "../../../../shared/infrastructure/middleware/authorize.middleware.ts";

export const businessDayRouter = new Router({ prefix: "/api/v1/business-day" });

businessDayRouter.use(authMiddleware);

// GET /api/v1/business-day/summary — Ver resumen de la jornada previa confirmación
businessDayRouter.get(
  "/summary",
  requirePermission("business_day:close", "reports:read"),
  (ctx) => businessDayController.getSummary(ctx)
);

// POST /api/v1/business-day/close — Finalizar la jornada del día (ADMIN / GERENTE / business_day:close)
businessDayRouter.post(
  "/close",
  requirePermission("business_day:close"),
  (ctx) => businessDayController.close(ctx)
);

import { Context } from "oak";
import { GetBusinessDaySummaryUseCase } from "../../application/use-cases/GetBusinessDaySummaryUseCase.ts";
import { CloseBusinessDayUseCase } from "../../application/use-cases/CloseBusinessDayUseCase.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";

export class BusinessDayController {
  constructor(
    private readonly getSummaryUseCase: GetBusinessDaySummaryUseCase,
    private readonly closeBusinessDayUseCase: CloseBusinessDayUseCase
  ) {}

  /**
   * GET /api/v1/business-day/summary
   * Retorna las métricas de la jornada actual previa confirmación
   */
  async getSummary(ctx: Context) {
    const url = ctx.request.url;
    const dateParam = url.searchParams.get("date") || undefined;

    const summary = await this.getSummaryUseCase.execute(dateParam);

    ctx.response.status = 200;
    ctx.response.body = {
      data: {
        businessDate: summary.businessDate,
        isClosed: summary.isClosed,
        openedAt: summary.openedAt ? summary.openedAt.toISOString() : new Date().toISOString(),
        totalOrdersCount: summary.totalOrdersCount,
        totalSalesAmount: summary.totalSalesAmount,
        totalCashAmount: summary.totalCashAmount,
        totalDigitalAmount: summary.totalDigitalAmount,
        totalCardAmount: summary.totalCardAmount,
        occupiedTablesCount: summary.occupiedTablesCount,
        openCashSessionsCount: summary.openCashSessionsCount,
        openCashSessionsDetails: summary.openCashSessionsDetails,
        pendingOrdersCount: summary.pendingOrdersCount,
        pendingOrdersDetails: summary.pendingOrdersDetails,
      },
    };
  }

  /**
   * POST /api/v1/business-day/close
   * Ejecuta el cierre de la jornada operativa.
   * Exige rol ADMIN / permiso business_day:close y toma el userId exclusivamente del JWT.
   */
  async close(ctx: Context) {
    const authUser = (ctx.state as any).user;
    if (!authUser || !authUser.id) {
      throw new ValidationError("Autenticación requerida para finalizar la jornada");
    }

    let notes: string | undefined = undefined;
    if (ctx.request.hasBody) {
      try {
        const body = ctx.request.body({ type: "json" });
        const val = await body.value;
        if (val && typeof val.notes === "string") {
          notes = val.notes;
        }
      } catch (_e) {
        // Body opcional
      }
    }

    const closure = await this.closeBusinessDayUseCase.execute({
      closedByUserId: authUser.id, // SIEMPRE del JWT
      notes,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      message: `Jornada del ${closure.businessDate} finalizada exitosamente`,
      data: {
        id: closure.id,
        businessDate: closure.businessDate,
        openedAt: closure.openedAt.toISOString(),
        closedAt: closure.closedAt.toISOString(),
        closedByUserId: closure.closedByUserId,
        totalOrdersCount: closure.totalOrdersCount,
        totalSalesAmount: closure.totalSalesAmount,
        totalCashAmount: closure.totalCashAmount,
        totalDigitalAmount: closure.totalDigitalAmount,
        totalCardAmount: closure.totalCardAmount,
      },
    };
  }
}

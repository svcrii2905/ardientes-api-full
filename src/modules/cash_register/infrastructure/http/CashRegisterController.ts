import { Context, RouterContext } from "oak";
import { OpenCashSessionUseCase, OpenCashSessionDTO } from "../../application/use-cases/OpenCashSessionUseCase.ts";
import { CloseCashSessionUseCase, CloseCashSessionDTO } from "../../application/use-cases/CloseCashSessionUseCase.ts";
import { GetCurrentCashSessionUseCase } from "../../application/use-cases/GetCurrentCashSessionUseCase.ts";
import { ListCashSessionsUseCase } from "../../application/use-cases/ListCashSessionsUseCase.ts";
import { CreateCashTransactionUseCase, CreateCashTransactionDTO } from "../../application/use-cases/CreateCashTransactionUseCase.ts";
import { CashTransactionRepository } from "../../domain/CashTransactionRepository.ts";
import { isStringWithin } from "../../../../common/validation.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";

export class CashRegisterController {
  constructor(
    private readonly openCashSessionUseCase: OpenCashSessionUseCase,
    private readonly closeCashSessionUseCase: CloseCashSessionUseCase,
    private readonly getCurrentCashSessionUseCase: GetCurrentCashSessionUseCase,
    private readonly listCashSessionsUseCase: ListCashSessionsUseCase,
    private readonly createCashTransactionUseCase: CreateCashTransactionUseCase,
    private readonly cashTransactionRepository: CashTransactionRepository
  ) {}

  /**
   * POST /api/v1/cash-registers/sessions/open
   * Abre un turno de caja.
   */
  async openSession(ctx: Context) {
    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    const payload = await body.value;

    if (payload.notes !== undefined && payload.notes !== null && !isStringWithin(payload.notes, 500)) {
      throw new ValidationError("Las notas deben ser una cadena de máximo 500 caracteres");
    }
    const authUser = (ctx.state as any).user;

    const dto: OpenCashSessionDTO = {
      registerId: Number(payload.registerId),
      userId: authUser ? authUser.id : Number(payload.userId),
      openingBalance: Number(payload.openingBalance),
      notes: payload.notes,
    };

    const session = await this.openCashSessionUseCase.execute(dto);

    ctx.response.status = 201;
    ctx.response.body = {
      message: "Sesión de caja abierta exitosamente",
      data: this.serializeSession(session),
    };
  }

  /**
   * POST /api/v1/cash-registers/sessions/:id/close
   * Cierra un turno de caja y realiza el arqueo.
   */
  async closeSession(ctx: RouterContext<"/sessions/:id/close">) {
    const sessionId = Number(ctx.params.id);
    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    const payload = await body.value;

    if (payload.discrepancyNotes !== undefined && payload.discrepancyNotes !== null && !isStringWithin(payload.discrepancyNotes, 500)) {
      throw new ValidationError("Las notas de discrepancia deben ser una cadena de máximo 500 caracteres");
    }
    const authUser = (ctx.state as any).user;

    const dto: CloseCashSessionDTO = {
      sessionId,
      userId: authUser ? authUser.id : Number(payload.userId),
      closingBalanceReal: Number(payload.closingBalanceReal),
      discrepancyNotes: payload.discrepancyNotes,
    };

    const session = await this.closeCashSessionUseCase.execute(dto);

    ctx.response.status = 200;
    ctx.response.body = {
      message: "Sesión de caja cerrada exitosamente",
      data: this.serializeSession(session),
    };
  }

  /**
   * GET /api/v1/cash-registers/sessions/active
   * Consulta la sesión activa por registerId o userId.
   * Query params: ?registerId=X o ?userId=Y
   */
  async getActiveSession(ctx: Context) {
    const registerIdParam = ctx.request.url.searchParams.get("registerId");
    const userIdParam = ctx.request.url.searchParams.get("userId");

    const registerId = registerIdParam ? Number(registerIdParam) : undefined;
    const userId = userIdParam ? Number(userIdParam) : undefined;

    const session = await this.getCurrentCashSessionUseCase.execute({ registerId, userId });

    if (!session) {
      ctx.response.status = 404;
      ctx.response.body = {
        message: "No se encontró ninguna sesión activa con los parámetros proporcionados",
      };
      return;
    }

    const totals = await this.cashTransactionRepository.calculateSessionTotals(session.id!, session.openingBalance);

    ctx.response.status = 200;
    ctx.response.body = {
      data: {
        ...this.serializeSession(session),
        totals
      }
    };
  }

  /**
   * GET /api/v1/cash-registers/sessions
   * Lista sesiones de caja con paginación y filtros.
   */
  async listSessions(ctx: Context) {
    const registerIdParam = ctx.request.url.searchParams.get("registerId");
    const userIdParam = ctx.request.url.searchParams.get("userId");
    const status = ctx.request.url.searchParams.get("status") || undefined;
    const limitParam = ctx.request.url.searchParams.get("limit");
    const offsetParam = ctx.request.url.searchParams.get("offset");

    const registerId = registerIdParam ? Number(registerIdParam) : undefined;
    const userId = userIdParam ? Number(userIdParam) : undefined;
    const limit = limitParam ? Number(limitParam) : undefined;
    const offset = offsetParam ? Number(offsetParam) : undefined;

    const sessions = await this.listCashSessionsUseCase.execute({
      registerId,
      userId,
      status,
      limit,
      offset,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      data: sessions.map((s) => this.serializeSession(s)),
      count: sessions.length,
    };
  }

  /**
   * POST /api/v1/cash-registers/sessions/:id/transactions
   * Registra un ingreso (DEPOSIT) o egreso (WITHDRAWAL) de efectivo.
   */
  async createTransaction(ctx: RouterContext<"/sessions/:id/transactions">) {
    const sessionId = Number(ctx.params.id);
    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    const payload = await body.value;

    if (payload.notes !== undefined && payload.notes !== null && !isStringWithin(payload.notes, 500)) {
      throw new ValidationError("Las notas deben ser una cadena de máximo 500 caracteres");
    }
    const authUser = (ctx.state as any).user;

    const dto: CreateCashTransactionDTO = {
      sessionId,
      transactionType: payload.transactionType,
      amount: Number(payload.amount),
      performedBy: authUser ? authUser.id : Number(payload.performedBy),
      notes: payload.notes,
    };

    const transaction = await this.createCashTransactionUseCase.execute(dto);

    ctx.response.status = 201;
    ctx.response.body = {
      message: "Movimiento de caja registrado exitosamente",
      data: this.serializeTransaction(transaction),
    };
  }

  /**
   * GET /api/v1/cash-registers/sessions/:id/transactions
   * Lista los movimientos de efectivo de una sesión de caja.
   */
  async listTransactions(ctx: RouterContext<"/sessions/:id/transactions">) {
    const sessionId = Number(ctx.params.id);
    const transactions = await this.cashTransactionRepository.findBySessionId(sessionId);

    ctx.response.status = 200;
    ctx.response.body = {
      data: transactions.map((tx) => this.serializeTransaction(tx)),
      count: transactions.length,
    };
  }

  private serializeSession(session: any): object {
    return {
      id: session.id,
      openedByUserId: session.openedByUserId,
      openedByUserName: session.openedByUserName ?? null,
      closedByUserId: session.closedByUserId,
      registerId: session.registerId,
      status: session.status?.value ?? session.status ?? null,
      openingBalance: session.openingBalance,
      closingBalanceExpected: session.closingBalanceExpected,
      closingBalanceReal: session.closingBalanceReal,
      discrepancyAmount: session.discrepancyAmount,
      notes: session.notes,
      discrepancyNotes: session.discrepancyNotes,
      openedAt: session.openedAt?.toISOString() ?? null,
      closedAt: session.closedAt?.toISOString() ?? null,
    };
  }

  private serializeTransaction(tx: any): object {
    return {
      id: tx.id,
      sessionId: tx.sessionId,
      transactionType: tx.transactionType?.value ?? tx.transactionType ?? null,
      orderPaymentId: tx.orderPaymentId,
      amount: tx.amount,
      performedBy: tx.performedBy,
      notes: tx.notes,
      createdAt: tx.createdAt?.toISOString() ?? null,
    };
  }
}

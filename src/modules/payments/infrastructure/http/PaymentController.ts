import { Context, RouterContext } from "oak";
import { ListPaymentMethodsUseCase } from "../../application/use-cases/ListPaymentMethodsUseCase.ts";
import { ProcessPaymentUseCase, ProcessPaymentDTO } from "../../application/use-cases/ProcessPaymentUseCase.ts";
import { RevertPaymentUseCase, RevertPaymentDTO } from "../../application/use-cases/RevertPaymentUseCase.ts";
import { GetOrderPaymentsUseCase } from "../../application/use-cases/GetOrderPaymentsUseCase.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";
import { isStringWithin, isNumberInRange } from "../../../../common/validation.ts";

export class PaymentController {
  constructor(
    private readonly listPaymentMethodsUseCase: ListPaymentMethodsUseCase,
    private readonly processPaymentUseCase: ProcessPaymentUseCase,
    private readonly revertPaymentUseCase: RevertPaymentUseCase,
    private readonly getOrderPaymentsUseCase: GetOrderPaymentsUseCase
  ) {}

  /**
   * GET /api/v1/payments/methods
   * Lista los métodos de pago disponibles (Efectivo, Tarjetas, Nequi, etc.).
   */
  async listMethods(ctx: Context) {
    const activeOnlyParam = ctx.request.url.searchParams.get("activeOnly");
    const activeOnly = activeOnlyParam === "false" ? false : true;

    const methods = await this.listPaymentMethodsUseCase.execute({ activeOnly });

    ctx.response.status = 200;
    ctx.response.body = {
      data: methods.map((m) => this.serializePaymentMethod(m)),
      count: methods.length,
    };
  }

  /**
   * POST /api/v1/payments
   * Registra un nuevo pago para una orden.
   * performedBy es inyectado exclusivamente desde el JWT — no puede ser enviado por el cliente.
   */
  async processPayment(ctx: Context) {
    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    const payload = await body.value;
    const authUser = (ctx.state as any).user;

    // --- Validación de entrada ---
    const orderId = Number(payload.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new ValidationError("orderId debe ser un entero positivo");
    }

    const paymentMethodId = Number(payload.paymentMethodId);
    if (!Number.isInteger(paymentMethodId) || paymentMethodId <= 0) {
      throw new ValidationError("paymentMethodId debe ser un entero positivo");
    }

    const amount = Number(payload.amount);
    if (!isNumberInRange(amount, 0.01, 1_000_000)) {
      throw new ValidationError("amount debe ser un número mayor a 0 y máximo 1,000,000");
    }
    // Verificar precisión: no más de 2 decimales
    if (Math.round(amount * 100) !== amount * 100) {
      throw new ValidationError("amount no debe tener más de 2 decimales");
    }

    if (payload.changeAmount !== undefined && payload.changeAmount !== null) {
      const change = Number(payload.changeAmount);
      if (isNaN(change) || !isFinite(change) || change < 0) {
        throw new ValidationError("changeAmount debe ser un número >= 0");
      }
    }

    if (payload.notes !== undefined && payload.notes !== null) {
      if (!isStringWithin(payload.notes, 255)) {
        throw new ValidationError("notes no debe exceder 255 caracteres");
      }
    }

    if (payload.transactionReference !== undefined && payload.transactionReference !== null) {
      if (!isStringWithin(payload.transactionReference, 100)) {
        throw new ValidationError("transactionReference no debe exceder 100 caracteres");
      }
    }

    if (payload.sessionId === undefined || payload.sessionId === null) {
      throw new ValidationError("sessionId es requerido");
    }
    const sessionId = Number(payload.sessionId);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      throw new ValidationError("sessionId debe ser un entero positivo");
    }

    const dto: ProcessPaymentDTO = {
      orderId,
      paymentMethodId,
      sessionId,
      amount,
      changeAmount: payload.changeAmount !== undefined && payload.changeAmount !== null
        ? Number(payload.changeAmount)
        : undefined,
      transactionReference: payload.transactionReference,
      performedBy: authUser.id,  // SIEMPRE del JWT — campo de auditoría
      notes: payload.notes,
    };

    const payment = await this.processPaymentUseCase.execute(dto);

    ctx.response.status = 201;
    ctx.response.body = {
      message: "Pago registrado exitosamente",
      data: this.serializePayment(payment),
    };
  }

  /**
   * GET /api/v1/payments/order/:orderId
   * Obtiene todos los pagos registrados para un pedido con resumen de totales.
   */
  async getPaymentsByOrder(ctx: RouterContext<"/api/v1/payments/order/:orderId">) {
    const orderId = Number(ctx.params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new ValidationError("orderId debe ser un entero positivo");
    }
    const summary = await this.getOrderPaymentsUseCase.execute(orderId);

    ctx.response.status = 200;
    ctx.response.body = {
      data: {
        orderId: summary.orderId,
        orderNumber: summary.orderNumber,
        orderTotal: summary.orderTotal,
        totalPaid: summary.totalPaid,
        totalChange: summary.totalChange,
        pendingBalance: summary.pendingBalance,
        isFullyPaid: summary.isFullyPaid,
        payments: summary.payments.map((p) => this.serializePayment(p)),
      },
    };
  }

  /**
   * PATCH /api/v1/payments/:id/revert
   * Revierte un pago en estado COMPLETADO.
   * performedBy es inyectado exclusivamente desde el JWT — campo de auditoría.
   */
  async revertPayment(ctx: RouterContext<"/api/v1/payments/:id/revert">) {
    const paymentId = Number(ctx.params.id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      throw new ValidationError("El ID del pago debe ser un entero positivo");
    }

    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    const payload = await body.value;
    const authUser = (ctx.state as any).user;

    if (payload.notes !== undefined && payload.notes !== null) {
      if (!isStringWithin(payload.notes, 255)) {
        throw new ValidationError("notes no debe exceder 255 caracteres");
      }
    }

    const dto: RevertPaymentDTO = {
      paymentId,
      performedBy: authUser.id,   // SIEMPRE del JWT — campo de auditoría
      notes: payload.notes,
    };

    const payment = await this.revertPaymentUseCase.execute(dto);

    ctx.response.status = 200;
    ctx.response.body = {
      message: `Pago #${paymentId} revertido exitosamente`,
      data: this.serializePayment(payment),
    };
  }

  private serializePaymentMethod(method: any): object {
    return {
      id: method.id,
      name: method.name,
      type: method.type.value,
      requiresReference: method.requiresReference,
      sortOrder: method.sortOrder,
      isActive: method.isActive,
    };
  }

  private serializePayment(payment: any): object {
    return {
      id: payment.id,
      orderId: payment.orderId,
      paymentMethodId: payment.paymentMethodId,
      sessionId: payment.sessionId,
      amount: payment.amount,
      changeAmount: payment.changeAmount,
      transactionReference: payment.transactionReference,
      status: payment.status?.value ?? payment.status ?? null,
      notes: payment.notes,
      createdAt: payment.createdAt?.toISOString() ?? null,
    };
  }
}

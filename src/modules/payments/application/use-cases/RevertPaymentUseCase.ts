import { OrderPayment } from "../../domain/OrderPayment.ts";
import { OrderPaymentRepository } from "../../domain/OrderPaymentRepository.ts";
import { PaymentOrderQueryPorts } from "./ProcessPaymentUseCase.ts";
import { ValidationError, NotFoundError } from "../../../../shared/domain/error.ts";

export interface RevertPaymentDTO {
  paymentId: number;
  performedBy: number;
  notes?: string;
}

export class RevertPaymentUseCase {
  constructor(
    private readonly orderPaymentRepository: OrderPaymentRepository,
    private readonly queryPorts: PaymentOrderQueryPorts
  ) {}

  async execute(dto: RevertPaymentDTO): Promise<OrderPayment> {
    if (!dto.paymentId || dto.paymentId <= 0) {
      throw new ValidationError("ID de pago no válido");
    }
    if (!dto.performedBy || dto.performedBy <= 0) {
      throw new ValidationError("Se requiere el ID del usuario responsable (performedBy)");
    }

    // 1. Obtener el pago existente
    const payment = await this.orderPaymentRepository.findById(dto.paymentId);
    if (!payment) {
      throw new NotFoundError(`Pago con ID ${dto.paymentId} no encontrado`);
    }

    if (payment.status.isRevertido()) {
      throw new ValidationError(`El pago con ID ${dto.paymentId} ya se encuentra REVERTIDO`);
    }

    // 2. Ejecutar la regla de dominio de reversión
    payment.revert();

    // 3. Actualizar en base de datos
    await this.orderPaymentRepository.updateStatus(
      dto.paymentId,
      "REVERTIDO",
      dto.performedBy,
      dto.notes
    );

    // 4. Recalcular el total de pagos activos del pedido
    const payments = await this.orderPaymentRepository.findByOrderId(payment.orderId);
    const completedPayments = payments.filter((p) => p.status.isCompletado() && p.id !== dto.paymentId);
    const newTotalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);

    const order = await this.queryPorts.findOrderById(payment.orderId);
    if (order && newTotalPaid < order.total) {
      // Si el pedido ya no está cubierto al 100%, retirar el timestamp de pagado
      await this.orderPaymentRepository.updateOrderPaidAt(payment.orderId, null);
    }

    return payment;
  }
}

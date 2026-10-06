import { OrderPayment } from "../../domain/OrderPayment.ts";
import { OrderPaymentRepository } from "../../domain/OrderPaymentRepository.ts";
import { PaymentOrderQueryPorts } from "./ProcessPaymentUseCase.ts";
import { NotFoundError, ValidationError } from "../../../../shared/domain/error.ts";

export interface OrderPaymentsSummaryResult {
  orderId: number;
  orderNumber: string;
  orderTotal: number;
  totalPaid: number;
  totalChange: number;
  pendingBalance: number;
  isFullyPaid: boolean;
  payments: OrderPayment[];
}

export class GetOrderPaymentsUseCase {
  constructor(
    private readonly orderPaymentRepository: OrderPaymentRepository,
    private readonly queryPorts: PaymentOrderQueryPorts
  ) {}

  async execute(orderId: number): Promise<OrderPaymentsSummaryResult> {
    if (!orderId || orderId <= 0) {
      throw new ValidationError("ID de pedido no válido");
    }

    const order = await this.queryPorts.findOrderById(orderId);
    if (!order) {
      throw new NotFoundError(`Pedido con ID ${orderId} no encontrado`);
    }

    const payments = await this.orderPaymentRepository.findByOrderId(orderId);
    const completedPayments = payments.filter((p) => p.status.isCompletado());

    const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalChange = completedPayments.reduce((sum, p) => sum + p.changeAmount, 0);
    const pendingBalance = Math.max(0, Math.round((order.total - totalPaid) * 100) / 100);
    const isFullyPaid = totalPaid >= order.total;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderTotal: order.total,
      totalPaid,
      totalChange,
      pendingBalance,
      isFullyPaid,
      payments,
    };
  }
}

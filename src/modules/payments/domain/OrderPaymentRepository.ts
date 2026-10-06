import { OrderPayment } from "./OrderPayment.ts";
import { PaymentStatusValue } from "./value-objects/PaymentStatus.ts";
import { QueryExecutor } from "../../../shared/infrastructure/database.ts";

export interface OrderPaymentRepository {
  /**
   * Persiste un pago y registra la correspondiente cash_transaction de forma atómica.
   */
  save(payment: OrderPayment, performedBy: number, executor?: QueryExecutor): Promise<OrderPayment>;

  /**
   * Busca un pago por su ID único.
   */
  findById(id: number, executor?: QueryExecutor): Promise<OrderPayment | null>;

  /**
   * Retorna todos los pagos registrados para un pedido.
   */
  findByOrderId(orderId: number, executor?: QueryExecutor): Promise<OrderPayment[]>;

  /**
   * Retorna todos los pagos registrados dentro de una sesión de caja.
   */
  findBySessionId(sessionId: number, executor?: QueryExecutor): Promise<OrderPayment[]>;

  /**
   * Actualiza el estado de un pago (ej: COMPLETADO -> REVERTIDO) y registra
   * opcionalmente la transacción de contra-asiento en caja.
   */
  updateStatus(id: number, status: PaymentStatusValue, performedBy: number, notes?: string, executor?: QueryExecutor): Promise<void>;

  /**
   * Actualiza el campo paid_at de un pedido cuando el pago se completa o revierte.
   */
  updateOrderPaidAt(orderId: number, paidAt: Date | null, executor?: QueryExecutor): Promise<void>;
}

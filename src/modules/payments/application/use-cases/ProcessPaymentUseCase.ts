import { OrderPayment } from "../../domain/OrderPayment.ts";
import { PaymentStatus } from "../../domain/value-objects/PaymentStatus.ts";
import { OrderPaymentRepository } from "../../domain/OrderPaymentRepository.ts";
import { PaymentMethodRepository } from "../../domain/PaymentMethodRepository.ts";
import { ValidationError, NotFoundError } from "../../../../shared/domain/error.ts";
import { TransactionManager, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

import { TableEventPublisher } from "../../../tables/domain/TableEventPublisher.ts";
import { TableRepository } from "../../../tables/domain/TableRepository.ts";

export interface OrderSnapshot {
  id: number;
  orderNumber: string;
  customerId: number | null;
  tableId?: number | null;
  total: number;
  status: string;
  paidAt: Date | null;
}

export interface CashSessionSnapshot {
  id: number;
  registerId: number;
  status: string;
}

export interface PaymentOrderQueryPorts {
  findOrderById(orderId: number, executor?: QueryExecutor, forUpdate?: boolean): Promise<OrderSnapshot | null>;
  findCashSessionById(sessionId: number, executor?: QueryExecutor): Promise<CashSessionSnapshot | null>;
}

export interface ProcessPaymentDTO {
  orderId: number;
  paymentMethodId: number;
  sessionId: number;
  amount: number;
  changeAmount?: number;
  transactionReference?: string;
  performedBy: number;
  notes?: string;
}

export class ProcessPaymentUseCase {
  constructor(
    private readonly orderPaymentRepository: OrderPaymentRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly queryPorts: PaymentOrderQueryPorts,
    private readonly transactionManager: TransactionManager,
    private readonly tableEventPublisher?: TableEventPublisher,
    private readonly tableRepository?: TableRepository
  ) {}

  async execute(dto: ProcessPaymentDTO): Promise<OrderPayment> {
    if (!dto.performedBy || dto.performedBy <= 0) {
      throw new ValidationError("Se requiere el ID del usuario responsable (performedBy)");
    }

    if (!dto.amount || typeof dto.amount !== "number" || isNaN(dto.amount) || dto.amount <= 0) {
      throw new ValidationError("El monto del pago debe ser mayor a cero");
    }

    let tableToReleaseId: number | null = null;

    const result = await this.transactionManager.runInTransaction(async (exec: QueryExecutor) => {
      // 1. Validar que el método de pago existe y está activo
      const method = await this.paymentMethodRepository.findById(dto.paymentMethodId, exec);
      if (!method) {
        throw new NotFoundError(`Método de pago con ID ${dto.paymentMethodId} no encontrado`);
      }
      if (!method.isActive) {
        throw new ValidationError(`El método de pago '${method.name}' no está activo`);
      }

      // 2. Si el método de pago requiere referencia, validar que se proporcione
      if (method.requiresReference) {
        if (!dto.transactionReference || dto.transactionReference.trim().length === 0) {
          throw new ValidationError(
            `El método de pago '${method.name}' requiere un número de referencia de transacción`
          );
        }
      }

      // 3. Validar que el pedido existe y no está cancelado (usando FOR UPDATE para evitar condiciones de carrera)
      const order = await this.queryPorts.findOrderById(dto.orderId, exec, true);
      if (!order) {
        throw new NotFoundError(`Pedido con ID ${dto.orderId} no encontrado`);
      }
      if (order.status === "CANCELADO") {
        throw new ValidationError(`No se pueden registrar pagos para el pedido #${order.orderNumber} porque está CANCELADO`);
      }

      // 4. Validar que la sesión de caja existe y está abierta
      const session = await this.queryPorts.findCashSessionById(dto.sessionId, exec);
      if (!session) {
        throw new NotFoundError(`Sesión de caja con ID ${dto.sessionId} no encontrada`);
      }
      if (session.status !== "OPEN") {
        throw new ValidationError(`La sesión de caja #${dto.sessionId} no está ABIERTA`);
      }

      // 5. Validar pagos previos del pedido y saldo pendiente
      const existingPayments = await this.orderPaymentRepository.findByOrderId(dto.orderId, exec);
      const completedPayments = existingPayments.filter((p) => p.status.isCompletado());
      const totalPaidSoFar = completedPayments.reduce((sum, p) => sum + p.amount, 0);

      if (totalPaidSoFar >= order.total || order.paidAt !== null) {
        throw new ValidationError(
          `La orden ya está pagada. (Pedido #${order.orderNumber})`
        );
      }

      const pendingBalance = Math.max(0, order.total - totalPaidSoFar);
      if (dto.amount > pendingBalance) {
        throw new ValidationError(
          `El monto del pago ($${dto.amount}) excede el saldo pendiente ($${pendingBalance}) del pedido #${order.orderNumber}`
        );
      }

      // 6. Construir la entidad de dominio OrderPayment
      const payment = new OrderPayment(
        null,
        dto.orderId,
        dto.paymentMethodId,
        dto.sessionId,
        dto.amount,
        dto.changeAmount ?? 0,
        dto.transactionReference?.trim() ?? null,
        PaymentStatus.completado(),
        dto.notes ?? null,
        null
      );

      // 7. Persistir atómicamente el pago y la transacción de caja propagando exec
      const savedPayment = await this.orderPaymentRepository.save(payment, dto.performedBy, exec);

      // 8. Verificar si con este pago se completa el total del pedido y actualizar únicamente orders.paid_at dentro de la misma transacción
      const newTotalPaid = totalPaidSoFar + dto.amount;
      if (newTotalPaid >= order.total) {
        await this.orderPaymentRepository.updateOrderPaidAt(dto.orderId, new Date(), exec);

        // 9. Fidelización: 1 pedido completado y pagado = +1 punto (si el cliente está identificado)
        // No generar puntos para pedidos cancelados (ya validado en paso 3) ni duplicar si ya se premió
        if (order.customerId) {
          const existingAwards = await exec.query(
            `SELECT id FROM loyalty_transactions WHERE order_id = ? AND reason = 'COMPRA' LIMIT 1`,
            [order.id]
          );

          if (existingAwards.length === 0) {
            await exec.execute(
              `INSERT INTO loyalty_transactions (customer_id, order_id, points_delta, reason, notes, created_by)
               VALUES (?, ?, 1, 'COMPRA', ?, ?)`,
              [
                order.customerId,
                order.id,
                `1 punto por compra completada (Pedido #${order.orderNumber})`,
                dto.performedBy,
              ]
            );

            await exec.execute(
              `UPDATE customers 
               SET loyalty_points = loyalty_points + 1,
                   total_orders = total_orders + 1,
                   total_spent = total_spent + ?
               WHERE id = ?`,
              [order.total, order.customerId]
            );
          }
        }

        // 10. Gestión de Mesas (Bloque 4): Si el pedido es de una MESA, verificar si todos sus pedidos están pagados
        if (order.tableId) {
          const unpaidRows = await exec.query(
            `SELECT id FROM orders WHERE table_id = ? AND id != ? AND status != 'CANCELADO' AND paid_at IS NULL LIMIT 1`,
            [order.tableId, order.id]
          );

          if (unpaidRows.length === 0) {
            // Todos los pedidos de la mesa están pagados -> LIBRE
            await exec.execute(
              `UPDATE tables SET status = 'LIBRE', account_requested = 0, updated_at = NOW() WHERE id = ?`,
              [order.tableId]
            );
            tableToReleaseId = order.tableId;
          }
        }
      }

      return savedPayment;
    });

    // Notificar por WebSocket si la mesa fue liberada
    if (tableToReleaseId && this.tableRepository && this.tableEventPublisher) {
      const freedTable = await this.tableRepository.findById(tableToReleaseId);
      if (freedTable) {
        this.tableEventPublisher.notifyTableStatusChanged(freedTable);
      }
    }

    return result;
  }
}

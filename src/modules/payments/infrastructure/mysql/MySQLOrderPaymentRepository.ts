import { OrderPayment } from "../../domain/OrderPayment.ts";
import { PaymentStatus, PaymentStatusValue } from "../../domain/value-objects/PaymentStatus.ts";
import { OrderPaymentRepository } from "../../domain/OrderPaymentRepository.ts";
import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

export class MySQLOrderPaymentRepository implements OrderPaymentRepository {
  /**
   * Persiste el pago y registra la transacción de caja de forma atómica.
   */
  async save(payment: OrderPayment, performedBy: number, dbExecutor?: QueryExecutor): Promise<OrderPayment> {
    const doSave = async (exec: QueryExecutor): Promise<OrderPayment> => {
      // 1. Insertar el pago en order_payments
      const paymentResult = await exec.execute(
        `INSERT INTO order_payments (
          order_id, payment_method_id, session_id, amount, change_amount,
          transaction_reference, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payment.orderId,
          payment.paymentMethodId,
          payment.sessionId,
          payment.amount,
          payment.changeAmount,
          payment.transactionReference,
          payment.status.value,
          payment.notes,
        ]
      );

      const paymentId = paymentResult.lastInsertId!;

      // 2. Registrar el movimiento en cash_transactions
      const txNotes = payment.notes
        ? `Pago de pedido #${payment.orderId} - ${payment.notes}`
        : `Pago de pedido #${payment.orderId}`;

      await exec.execute(
        `INSERT INTO cash_transactions (
          session_id, transaction_type, order_payment_id, amount, performed_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          payment.sessionId,
          "ORDER_PAYMENT",
          paymentId,
          payment.amount,
          performedBy,
          txNotes,
        ]
      );

      return new OrderPayment(
        paymentId,
        payment.orderId,
        payment.paymentMethodId,
        payment.sessionId,
        payment.amount,
        payment.changeAmount,
        payment.transactionReference,
        payment.status,
        payment.notes,
        new Date()
      );
    };

    if (dbExecutor) {
      return await doSave(dbExecutor);
    } else {
      return await client.transaction(async (conn) => {
        return await doSave(conn);
      });
    }
  }

  async findById(id: number): Promise<OrderPayment | null> {
    const rows = await client.query(
      `SELECT id, order_id, payment_method_id, session_id, amount, change_amount,
              transaction_reference, status, notes, created_at
       FROM order_payments WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return null;

    return this.mapToDomain(rows[0]);
  }

  async findByOrderId(orderId: number): Promise<OrderPayment[]> {
    const rows = await client.query(
      `SELECT id, order_id, payment_method_id, session_id, amount, change_amount,
              transaction_reference, status, notes, created_at
       FROM order_payments WHERE order_id = ? ORDER BY created_at ASC`,
      [orderId]
    );

    return rows.map((row: any) => this.mapToDomain(row));
  }

  async findBySessionId(sessionId: number): Promise<OrderPayment[]> {
    const rows = await client.query(
      `SELECT id, order_id, payment_method_id, session_id, amount, change_amount,
              transaction_reference, status, notes, created_at
       FROM order_payments WHERE session_id = ? ORDER BY created_at DESC`,
      [sessionId]
    );

    return rows.map((row: any) => this.mapToDomain(row));
  }

  async updateStatus(
    id: number,
    status: PaymentStatusValue,
    performedBy: number,
    notes?: string,
    dbExecutor?: QueryExecutor
  ): Promise<void> {
    const doUpdateStatus = async (exec: QueryExecutor): Promise<void> => {
      // 1. Obtener los datos del pago
      const paymentRows = await exec.query(
        `SELECT id, order_id, session_id, amount FROM order_payments WHERE id = ? LIMIT 1`,
        [id]
      );

      if (paymentRows.length === 0) {
        throw new Error(`Pago con ID ${id} no encontrado`);
      }

      const paymentRow = paymentRows[0];

      // 2. Actualizar el estado del pago
      await exec.execute(
        `UPDATE order_payments SET status = ? WHERE id = ?`,
        [status, id]
      );

      // 3. Si se revierte, registrar una transacción de retiro/contra-asiento en caja
      if (status === "REVERTIDO") {
        const revertNotes = notes
          ? `Reversión de pago #${id} para pedido #${paymentRow.order_id}: ${notes}`
          : `Reversión de pago #${id} para pedido #${paymentRow.order_id}`;

        await exec.execute(
          `INSERT INTO cash_transactions (
            session_id, transaction_type, order_payment_id, amount, performed_by, notes
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            paymentRow.session_id,
            "WITHDRAWAL",
            id,
            paymentRow.amount,
            performedBy,
            revertNotes,
          ]
        );
      }
    };

    if (dbExecutor) {
      await doUpdateStatus(dbExecutor);
    } else {
      await client.transaction(async (conn) => {
        await doUpdateStatus(conn);
      });
    }
  }

  async updateOrderPaidAt(orderId: number, paidAt: Date | null, dbExecutor?: QueryExecutor): Promise<void> {
    const exec = dbExecutor || client;
    const paidAtFormatted = paidAt
      ? paidAt.toISOString().slice(0, 19).replace("T", " ")
      : null;

    await exec.execute(
      `UPDATE orders SET paid_at = ? WHERE id = ?`,
      [paidAtFormatted, orderId]
    );
  }

  private mapToDomain(row: any): OrderPayment {
    return new OrderPayment(
      row.id,
      row.order_id,
      row.payment_method_id,
      row.session_id,
      Number(row.amount),
      Number(row.change_amount),
      row.transaction_reference ?? null,
      PaymentStatus.create(row.status),
      row.notes ?? null,
      row.created_at ? new Date(row.created_at) : null
    );
  }
}

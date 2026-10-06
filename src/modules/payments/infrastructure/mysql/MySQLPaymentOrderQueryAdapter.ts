import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";
import {
  PaymentOrderQueryPorts,
  OrderSnapshot,
  CashSessionSnapshot,
} from "../../application/use-cases/ProcessPaymentUseCase.ts";

/**
 * Adaptador Anti-Corruption Layer (ACL) para consultar datos de Pedidos y Sesiones de Caja
 * desde el módulo de Pagos sin acoplar directamente las entidades del dominio.
 */
export class MySQLPaymentOrderQueryAdapter implements PaymentOrderQueryPorts {
  async findOrderById(orderId: number, dbExecutor?: QueryExecutor, forUpdate: boolean = false): Promise<OrderSnapshot | null> {
    const exec = dbExecutor || client;
    const sql = `SELECT id, order_number, customer_id, table_id, total, status, paid_at FROM orders WHERE id = ? LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`;
    const rows = await exec.query(sql, [orderId]);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      orderNumber: row.order_number,
      customerId: row.customer_id ? Number(row.customer_id) : null,
      tableId: row.table_id ? Number(row.table_id) : null,
      total: Number(row.total),
      status: row.status,
      paidAt: row.paid_at ? new Date(row.paid_at) : null,
    };
  }

  async findCashSessionById(sessionId: number, dbExecutor?: QueryExecutor): Promise<CashSessionSnapshot | null> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      `SELECT id, register_id, status FROM cash_sessions WHERE id = ? LIMIT 1`,
      [sessionId]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      registerId: row.register_id,
      status: row.status,
    };
  }
}

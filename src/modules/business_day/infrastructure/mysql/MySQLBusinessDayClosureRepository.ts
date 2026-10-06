import { BusinessDayClosure } from "../../domain/BusinessDayClosure.ts";
import { BusinessDayClosureRepository, DaySummaryDTO } from "../../domain/BusinessDayClosureRepository.ts";
import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

export class MySQLBusinessDayClosureRepository implements BusinessDayClosureRepository {
  async findByDate(businessDate: string, dbExecutor?: QueryExecutor): Promise<BusinessDayClosure | null> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      `SELECT * FROM business_day_closures WHERE business_date = ? LIMIT 1`,
      [businessDate]
    );

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async save(closure: BusinessDayClosure, dbExecutor?: QueryExecutor): Promise<BusinessDayClosure> {
    const exec = dbExecutor || client;
    const openedAtFormatted = closure.openedAt.toISOString().slice(0, 19).replace("T", " ");
    const closedAtFormatted = closure.closedAt.toISOString().slice(0, 19).replace("T", " ");

    const result = await exec.execute(
      `INSERT INTO business_day_closures (
        business_date, opened_at, closed_at, closed_by_user_id,
        total_orders_count, total_sales_amount, total_cash_amount,
        total_digital_amount, total_card_amount, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        closure.businessDate,
        openedAtFormatted,
        closedAtFormatted,
        closure.closedByUserId,
        closure.totalOrdersCount,
        closure.totalSalesAmount,
        closure.totalCashAmount,
        closure.totalDigitalAmount,
        closure.totalCardAmount,
        closure.notes,
      ]
    );

    const insertedId = result.lastInsertId!;
    return new BusinessDayClosure(
      insertedId,
      closure.businessDate,
      closure.openedAt,
      closure.closedAt,
      closure.closedByUserId,
      closure.totalOrdersCount,
      closure.totalSalesAmount,
      closure.totalCashAmount,
      closure.totalDigitalAmount,
      closure.totalCardAmount,
      closure.notes,
      new Date()
    );
  }

  async resetTablesToAvailable(dbExecutor?: QueryExecutor): Promise<void> {
    const exec = dbExecutor || client;
    await exec.execute(
      `UPDATE \`tables\`
       SET \`status\` = 'AVAILABLE', \`account_requested\` = 0, \`updated_at\` = NOW()
       WHERE \`status\` != 'RESERVED'`
    );
  }

  async getDaySummary(businessDate: string, dbExecutor?: QueryExecutor): Promise<DaySummaryDTO> {
    const exec = dbExecutor || client;

    // 1. Verificar si ya fue cerrado
    const closureRows = await exec.query(
      `SELECT * FROM business_day_closures WHERE business_date = ? LIMIT 1`,
      [businessDate]
    );
    const isClosed = closureRows.length > 0;

    // 2. Determinar hora de inicio de jornada objetivamente (primer pedido o primera sesión de caja del día)
    const activityRows = await exec.query(
      `SELECT MIN(t.activity_time) AS first_activity
       FROM (
         SELECT MIN(created_at) AS activity_time FROM orders WHERE order_date = ? OR DATE(created_at) = ?
         UNION ALL
         SELECT MIN(opened_at) AS activity_time FROM cash_sessions WHERE DATE(opened_at) = ?
       ) t`,
      [businessDate, businessDate, businessDate]
    );
    const openedAtRaw = activityRows[0]?.first_activity;
    const openedAt = openedAtRaw ? new Date(openedAtRaw) : new Date();

    // 3. Totales de pedidos del día
    const ordersCountRows = await exec.query(
      `SELECT COUNT(*) AS total_cnt, COALESCE(SUM(total), 0) AS total_sales
       FROM orders
       WHERE (order_date = ? OR DATE(created_at) = ?) AND status != 'CANCELADO' AND paid_at IS NOT NULL`,
      [businessDate, businessDate]
    );
    const totalOrdersCount = Number(ordersCountRows[0]?.total_cnt || 0);
    const totalSalesAmount = Number(ordersCountRows[0]?.total_sales || 0);

    // 4. Totales recaudados por medio de pago
    const paymentRows = await exec.query(
      `SELECT pm.type, COALESCE(SUM(op.amount), 0) AS total_amount
       FROM order_payments op
       JOIN orders o ON o.id = op.order_id
       JOIN payment_methods pm ON pm.id = op.payment_method_id
       WHERE (o.order_date = ? OR DATE(o.created_at) = ?)
         AND op.status = 'COMPLETADO'
       GROUP BY pm.type`,
      [businessDate, businessDate]
    );

    let totalCashAmount = 0;
    let totalDigitalAmount = 0;
    let totalCardAmount = 0;

    for (const p of paymentRows) {
      const amt = Number(p.total_amount || 0);
      if (p.type === "CASH") totalCashAmount += amt;
      else if (p.type === "DIGITAL") totalDigitalAmount += amt;
      else if (p.type === "CARD") totalCardAmount += amt;
    }

    // 5. Mesas ocupadas
    const tablesCountRows = await exec.query(
      `SELECT COUNT(*) AS cnt FROM \`tables\` WHERE status IN ('OCUPADA', 'OCCUPIED')`
    );
    const occupiedTablesCount = Number(tablesCountRows[0]?.cnt || 0);

    // 6. Cajas abiertas y detalles de titularidad
    const openSessionsRows = await exec.query(
      `SELECT cs.register_id, cs.opened_by_user_id,
              COALESCE(NULLIF(TRIM(u.full_name), ''), u.username, CONCAT('Usuario #', cs.opened_by_user_id)) AS opened_by_user_name
       FROM cash_sessions cs
       LEFT JOIN users u ON u.id = cs.opened_by_user_id
       WHERE cs.status = 'OPEN'`
    );
    const openCashSessionsCount = openSessionsRows.length;
    const openCashSessionsDetails = openSessionsRows.map((r: any) => ({
      registerId: Number(r.register_id),
      openedByUserId: Number(r.opened_by_user_id),
      openedByUserName: String(r.opened_by_user_name),
    }));

    // 7. Pedidos pendientes (en cocina o mesa sin pagar)
    const pendingOrdersRows = await exec.query(
      `SELECT id, order_number, daily_order_number, table_id, status
       FROM orders
       WHERE status IN ('PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO')
          OR (table_id IS NOT NULL AND status != 'CANCELADO' AND paid_at IS NULL)`
    );
    const pendingOrdersCount = pendingOrdersRows.length;
    const pendingOrdersDetails = pendingOrdersRows.map((r: any) => ({
      id: Number(r.id),
      orderNumber: String(r.order_number),
      displayOrderNumber: r.daily_order_number ? `PEDIDO ${r.daily_order_number}` : String(r.order_number),
      tableId: r.table_id ? Number(r.table_id) : null,
      status: String(r.status),
    }));

    return {
      businessDate,
      isClosed,
      openedAt,
      totalOrdersCount,
      totalSalesAmount,
      totalCashAmount,
      totalDigitalAmount,
      totalCardAmount,
      occupiedTablesCount,
      openCashSessionsCount,
      openCashSessionsDetails,
      pendingOrdersCount,
      pendingOrdersDetails,
    };
  }

  private mapToDomain(row: any): BusinessDayClosure {
    return new BusinessDayClosure(
      row.id,
      typeof row.business_date === "string"
        ? row.business_date.slice(0, 10)
        : (row.business_date instanceof Date
            ? row.business_date.toISOString().slice(0, 10)
            : String(row.business_date).slice(0, 10)),
      row.opened_at ? new Date(row.opened_at) : new Date(),
      row.closed_at ? new Date(row.closed_at) : new Date(),
      Number(row.closed_by_user_id),
      Number(row.total_orders_count),
      Number(row.total_sales_amount),
      Number(row.total_cash_amount),
      Number(row.total_digital_amount),
      Number(row.total_card_amount),
      row.notes ?? null,
      row.created_at ? new Date(row.created_at) : null
    );
  }
}

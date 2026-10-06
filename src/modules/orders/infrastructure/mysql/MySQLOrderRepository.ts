import { Order } from "../../domain/Order.ts";
import { OrderItem } from "../../domain/OrderItem.ts";
import { OrderItemTopping } from "../../domain/OrderItemTopping.ts";
import { OrderBeverage } from "../../domain/OrderBeverage.ts";
import { OrderCombo } from "../../domain/OrderCombo.ts";
import { OrderStatusHistory } from "../../domain/OrderStatusHistory.ts";
import { OrderRepository, OrderFilters } from "../../domain/OrderRepository.ts";
import { OrderType } from "../../domain/value-objects/OrderType.ts";
import { OrderStatus, OrderStatusValue } from "../../domain/value-objects/OrderStatus.ts";
import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

export class MySQLOrderRepository implements OrderRepository {

  // ─── save ──────────────────────────────────────────────────────────────────
  /**
   * Persiste el pedido completo en una transacción atómica:
   * orders → order_combos → order_items → order_item_toppings → order_beverages
   */
  async save(order: Order, dbExecutor?: QueryExecutor): Promise<Order> {
    const doSave = async (exec: QueryExecutor): Promise<Order> => {
      // 0. Obtener fecha local de Colombia (America/Bogota) y secuencia diaria atómica
      const orderDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

      await exec.execute(
        `INSERT INTO daily_order_sequences (sequence_date, last_value)
         VALUES (?, LAST_INSERT_ID(1))
         ON DUPLICATE KEY UPDATE last_value = LAST_INSERT_ID(last_value + 1)`,
        [orderDateStr]
      );

      const seqRows = await exec.query(`SELECT LAST_INSERT_ID() AS assigned_daily_number`);
      const dailyOrderNum = Number(seqRows[0].assigned_daily_number);

      // 1. Insertar el pedido (header)
      const orderResult = await exec.execute(
        `INSERT INTO orders (
          order_number, customer_id, user_id, order_type, table_id,
          delivery_address, delivery_user_id, delivery_company, status,
          promotion_id, subtotal, discount_amount, tax_amount, disposable_fee, total, notes, kitchen_started_at,
          order_date, daily_order_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.orderNumber,
          order.customerId,
          order.userId,
          order.orderType.value,
          order.tableId,
          order.deliveryAddress,
          order.deliveryUserId,
          order.deliveryCompany,
          order.status.value,
          order.promotionId,
          order.subtotal,
          order.discountAmount,
          order.taxAmount,
          order.disposableFee,
          order.total,
          order.notes,
          order.kitchenStartedAt ? order.kitchenStartedAt.toISOString().slice(0, 19).replace("T", " ") : null,
          orderDateStr,
          dailyOrderNum,
        ]
      );
      const orderId = orderResult.lastInsertId!;

      // 2. Insertar combos y obtener sus IDs generados
      const savedCombos: OrderCombo[] = [];
      for (const combo of order.combos) {
        const comboResult = await exec.execute(
          `INSERT INTO order_combos (order_id, combo_id, combo_name, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, combo.comboId, combo.comboName, combo.quantity, combo.unitPrice, combo.lineTotal]
        );
        const savedCombo = new OrderCombo(
          comboResult.lastInsertId!,
          orderId,
          combo.comboId,
          combo.comboName,
          combo.quantity,
          combo.unitPrice,
          combo.items,
          combo.beverages
        );
        savedCombos.push(savedCombo);
      }

      // 3. Insertar ítems de producto
      const savedItems: OrderItem[] = [];
      for (const item of order.items) {
        const itemResult = await exec.execute(
          `INSERT INTO order_items (
            order_id, product_id, order_combo_id, quantity,
            menu_type, unit_price, toppings_extra_price, line_total, notes, product_name
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.productId,
            item.orderComboId,
            item.quantity,
            item.menuType,
            item.unitPrice,
            item.toppingsExtraPrice,
            item.lineTotal,
            item.notes,
            item.productName,
          ]
        );
        const orderItemId = itemResult.lastInsertId!;

        // 4. Insertar toppings de cada ítem
        const savedToppings: OrderItemTopping[] = [];
        for (const topping of item.toppings) {
          const toppingResult = await exec.execute(
            `INSERT INTO order_item_toppings (order_item_id, topping_id, topping_name, quantity, extra_price)
             VALUES (?, ?, ?, ?, ?)`,
            [orderItemId, topping.toppingId, topping.toppingName, topping.quantity, topping.extraPrice]
          );
          savedToppings.push(
            new OrderItemTopping(
              toppingResult.lastInsertId!,
              orderItemId,
              topping.toppingId,
              topping.toppingName,
              topping.quantity,
              topping.extraPrice
            )
          );
        }

        savedItems.push(
          new OrderItem(
            orderItemId,
            orderId,
            item.productId,
            item.orderComboId,
            item.quantity,
            item.menuType,
            item.unitPrice,
            item.toppingsExtraPrice,
            item.notes,
            savedToppings
          )
        );
      }

      // 5. Insertar bebidas (independientes y de combo)
      const savedBeverages: OrderBeverage[] = [];
      for (const bev of order.beverages) {
        const bevResult = await exec.execute(
          `INSERT INTO order_beverages (order_id, beverage_id, order_combo_id, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, bev.beverageId, bev.orderComboId, bev.quantity, bev.unitPrice, bev.lineTotal]
        );
        savedBeverages.push(
          new OrderBeverage(
            bevResult.lastInsertId!,
            orderId,
            bev.beverageId,
            bev.orderComboId,
            bev.quantity,
            bev.unitPrice
          )
        );
      }

      return new Order(
        orderId,
        order.orderNumber,
        order.customerId,
        order.userId,
        order.orderType,
        order.tableId,
        order.deliveryAddress,
        order.deliveryUserId,
        order.deliveryCompany,
        order.status,
        order.promotionId,
        order.subtotal,
        order.discountAmount,
        order.taxAmount,
        order.disposableFee,
        order.total,
        order.notes,
        new Date(),
        new Date(),
        null,
        order.kitchenStartedAt ?? null,
        savedItems,
        savedBeverages,
        savedCombos,
        order.customerName,
        true,
        orderDateStr,
        dailyOrderNum
      );
    };

    if (dbExecutor) {
      return await doSave(dbExecutor);
    } else {
      return await client.transaction(async (conn: QueryExecutor) => {
          return await doSave(conn);
        });
    }
  }

  // ─── findById ──────────────────────────────────────────────────────────────
  async findById(id: number): Promise<Order | null> {
    const orderRows = await client.query(
      `SELECT * FROM orders WHERE id = ? LIMIT 1`,
      [id]
    );
    if (orderRows.length === 0) return null;

    const row = orderRows[0];

    // Cargar ítems con sus toppings
    const items = await this.loadItemsForOrder(id);

    // Cargar bebidas
    const beverages = await this.loadBeveragesForOrder(id);

    // Cargar combos
    const combos = await this.loadCombosForOrder(id);

    return this.mapToDomain(row, items, beverages, combos);
  }

  // ─── findByOrderNumber ─────────────────────────────────────────────────────
  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    const rows = await client.query(
      `SELECT * FROM orders WHERE order_number = ? LIMIT 1`,
      [orderNumber]
    );
    if (rows.length === 0) return null;

    const row = rows[0];
    const items = await this.loadItemsForOrder(row.id);
    const beverages = await this.loadBeveragesForOrder(row.id);
    const combos = await this.loadCombosForOrder(row.id);

    return this.mapToDomain(row, items, beverages, combos);
  }

  // ─── findAll ───────────────────────────────────────────────────────────────
  /**
   * Lista liviana de pedidos sin ítems anidados para mejor performance en listas.
   */
  async findAll(filters: OrderFilters = {}): Promise<Order[]> {
    let query = `SELECT * FROM orders WHERE 1=1`;
    const params: any[] = [];

    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }
    if (filters.orderType) {
      query += ` AND order_type = ?`;
      params.push(filters.orderType);
    }
    if (filters.customerId) {
      query += ` AND customer_id = ?`;
      params.push(filters.customerId);
    }
    if (filters.userId) {
      query += ` AND user_id = ?`;
      params.push(filters.userId);
    }
    if (filters.dateFrom) {
      query += ` AND created_at >= ?`;
      params.push(filters.dateFrom.toISOString().slice(0, 19).replace("T", " "));
    }
    if (filters.dateTo) {
      query += ` AND created_at <= ?`;
      params.push(filters.dateTo.toISOString().slice(0, 19).replace("T", " "));
    }

    query += ` ORDER BY created_at DESC`;

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = await client.query(query, params);

    // Vista de lista: no cargamos ítems anidados para mejor performance
    return rows.map((row: any) => this.mapToDomain(row, [], [], []));
  }

  // ─── updateStatus ──────────────────────────────────────────────────────────
  async updateStatus(orderId: number, status: OrderStatusValue): Promise<void> {
    await client.execute(
      `UPDATE orders SET status = ? WHERE id = ?`,
      [status, orderId]
    );
  }

  // ─── dispatchDelivery ──────────────────────────────────────────────────────
  async dispatchDelivery(orderId: number, deliveryUserId: number | null, deliveryCompany: string | null, changedBy: number): Promise<boolean> {
    return await client.transaction(async (conn: QueryExecutor) => {
      // 1. Intentar actualizar de forma optimista
      const result = await conn.execute(
        `UPDATE orders 
         SET status = 'EN_CAMINO', delivery_user_id = ?, delivery_company = ? 
         WHERE id = ? AND status = 'LISTO' AND order_type = 'DOMICILIO'`,
        [deliveryUserId, deliveryCompany, orderId]
      );

      // Si affectedRows === 0, significa que el pedido no existe, no era DOMICILIO,
      // no estaba LISTO o ya fue despachado concurrente.
      if (result.affectedRows === 0) {
        return false;
      }

      // 2. Insertar en historial de forma atómica
      await conn.execute(
        `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, notes)
         VALUES (?, 'LISTO', 'EN_CAMINO', ?, 'Pedido despachado a domiciliario')`,
        [orderId, changedBy]
      );

      return true;
    });
  }

  // ─── updateKitchenStartedAt ────────────────────────────────────────────────
  async updateKitchenStartedAt(orderId: number, date: Date): Promise<void> {
    const formatted = date.toISOString().slice(0, 19).replace("T", " ");
    await client.execute(
      `UPDATE orders SET kitchen_started_at = ? WHERE id = ?`,
      [formatted, orderId]
    );
  }

  // ─── findKitchenOrders ─────────────────────────────────────────────────────
  async findKitchenOrders(activeOnly = true): Promise<Order[]> {
    const statuses = activeOnly
      ? ["CONFIRMADO", "EN_PREPARACION"]
      : ["CONFIRMADO", "EN_PREPARACION", "LISTO"];

    const placeholders = statuses.map(() => "?").join(", ");
    const rows = await client.query(
      `SELECT o.*, c.full_name as customer_name
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.status IN (${placeholders})
       ORDER BY COALESCE(o.kitchen_started_at, o.created_at) ASC, o.id ASC`,
      statuses
    );

    const orders: Order[] = [];
    for (const row of rows) {
      const items = await this.loadItemsForOrder(row.id);
      const beverages = await this.loadBeveragesForOrder(row.id);
      const combos = await this.loadCombosForOrder(row.id);
      orders.push(this.mapToDomain(row, items, beverages, combos));
    }

    return orders;
  }

  // ─── findByTableId ─────────────────────────────────────────────────────────
  async findByTableId(tableId: number, activeOnly = true): Promise<Order[]> {
    let query = `SELECT o.*, c.full_name as customer_name
                 FROM orders o
                 LEFT JOIN customers c ON c.id = o.customer_id
                 WHERE o.table_id = ?`;
    const params: any[] = [tableId];

    if (activeOnly) {
      query += ` AND o.status != 'CANCELADO' AND o.paid_at IS NULL`;
    }

    query += ` ORDER BY o.id ASC`;

    const rows = await client.query(query, params);
    const orders: Order[] = [];
    for (const row of rows) {
      const items = await this.loadItemsForOrder(row.id);
      const beverages = await this.loadBeveragesForOrder(row.id);
      const combos = await this.loadCombosForOrder(row.id);
      orders.push(this.mapToDomain(row, items, beverages, combos));
    }

    return orders;
  }

  // ─── saveStatusHistory ─────────────────────────────────────────────────────
  async saveStatusHistory(history: OrderStatusHistory): Promise<OrderStatusHistory> {
    const result = await client.execute(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [
        history.orderId,
        history.fromStatus,
        history.toStatus,
        history.changedBy,
        history.notes,
      ]
    );
    return new OrderStatusHistory(
      result.lastInsertId!,
      history.orderId,
      history.fromStatus,
      history.toStatus,
      history.changedBy,
      history.notes,
      new Date()
    );
  }

  // ─── Helpers de carga anidada ──────────────────────────────────────────────

  private async loadItemsForOrder(orderId: number): Promise<OrderItem[]> {
    const itemRows = await client.query(
      `SELECT oi.*, COALESCE(oi.product_name, p.name) as product_name
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    const items: OrderItem[] = [];
    for (const row of itemRows) {
      const toppingRows = await client.query(
        `SELECT * FROM order_item_toppings WHERE order_item_id = ?`,
        [row.id]
      );
      const toppings = toppingRows.map((tr: any) =>
        new OrderItemTopping(
          tr.id,
          tr.order_item_id,
          tr.topping_id,
          tr.topping_name,
          tr.quantity,
          Number(tr.extra_price)
        )
      );
      items.push(
        new OrderItem(
          row.id,
          row.order_id,
          row.product_id,
          row.order_combo_id ?? null,
          row.quantity,
          row.menu_type,
          Number(row.unit_price),
          Number(row.toppings_extra_price),
          row.notes ?? null,
          toppings,
          row.product_name ?? null
        )
      );
    }
    return items;
  }

  private async loadBeveragesForOrder(orderId: number): Promise<OrderBeverage[]> {
    const rows = await client.query(
      `SELECT ob.*, b.name as beverage_name
       FROM order_beverages ob
       LEFT JOIN beverages b ON b.id = ob.beverage_id
       WHERE ob.order_id = ?`,
      [orderId]
    );
    return rows.map((row: any) =>
      new OrderBeverage(
        row.id,
        row.order_id,
        row.beverage_id,
        row.order_combo_id ?? null,
        row.quantity,
        Number(row.unit_price),
        row.beverage_name ?? null
      )
    );
  }

  private async loadCombosForOrder(orderId: number): Promise<OrderCombo[]> {
    const rows = await client.query(
      `SELECT * FROM order_combos WHERE order_id = ?`,
      [orderId]
    );
    return rows.map((row: any) =>
      new OrderCombo(
        row.id,
        row.order_id,
        row.combo_id,
        row.combo_name,
        row.quantity,
        Number(row.unit_price),
        [], // Los ítems de combo se pueden leer filtrados por order_combo_id si se necesitan
        []
      )
    );
  }

  // ─── Mapper ────────────────────────────────────────────────────────────────

  private mapToDomain(
    row: any,
    items: OrderItem[],
    beverages: OrderBeverage[],
    combos: OrderCombo[]
  ): Order {
    let orderDateStr: string | null = null;
    if (row.order_date) {
      if (typeof row.order_date === "string") {
        orderDateStr = row.order_date.slice(0, 10);
      } else if (row.order_date instanceof Date) {
        orderDateStr = row.order_date.toISOString().slice(0, 10);
      } else {
        orderDateStr = String(row.order_date).slice(0, 10);
      }
    }

    return new Order(
      row.id,
      row.order_number,
      row.customer_id ?? null,
      row.user_id,
      OrderType.fromDB(row.order_type),
      row.table_id ?? null,
      row.delivery_address ?? null,
      row.delivery_user_id ?? null,
      row.delivery_company ?? null,
      OrderStatus.fromDB(row.status),
      row.promotion_id ?? null,
      Number(row.subtotal),
      Number(row.discount_amount),
      Number(row.tax_amount),
      Number(row.disposable_fee ?? 0),
      Number(row.total),
      row.notes ?? null,
      row.created_at ? new Date(row.created_at) : null,
      row.updated_at ? new Date(row.updated_at) : null,
      row.paid_at ? new Date(row.paid_at) : null,
      row.kitchen_started_at ? new Date(row.kitchen_started_at) : null,
      items,
      beverages,
      combos,
      row.customer_name ?? null,
      true, // skipValidation: entity is being reconstructed from DB, already validated at creation
      orderDateStr,
      row.daily_order_number !== null && row.daily_order_number !== undefined
        ? Number(row.daily_order_number)
        : null
    );
  }
}

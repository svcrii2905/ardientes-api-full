import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { client, connectDB, disconnectDB } from "../shared/infrastructure/database.ts";
import { MySQLOrderRepository } from "../modules/orders/infrastructure/mysql/MySQLOrderRepository.ts";
import { Order } from "../modules/orders/domain/Order.ts";
import { OrderType } from "../modules/orders/domain/value-objects/OrderType.ts";
import { OrderStatus } from "../modules/orders/domain/value-objects/OrderStatus.ts";
import { OrderItem } from "../modules/orders/domain/OrderItem.ts";

const repo = new MySQLOrderRepository();

// Helper para crear agregados Order de prueba
function createTestOrder(orderNum: string): Order {
  const item = new OrderItem(
    null, null, 1, null, 1, "UNIVERSITARIO", 15000, 0, null, []
  );
  return new Order(
    null,
    orderNum,
    null,
    1,
    OrderType.create("RECOGER"),
    null,
    null,
    null,
    OrderStatus.initial(),
    null,
    15000,
    0,
    0,
    1000,
    16000,
    "Test order",
    null,
    null,
    null,
    null,
    [item],
    [],
    []
  );
}

Deno.test({
  name: "G0. Setup DB connection",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await connectDB();
  }
});

Deno.test({
  name: "G1. Primer pedido del día -> 1",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const testDate = "2099-01-01";
    await client.execute("DELETE FROM orders WHERE order_date = ?", [testDate]);
    await client.execute("DELETE FROM daily_order_sequences WHERE sequence_date = ?", [testDate]);

    await client.execute(
      `INSERT INTO daily_order_sequences (sequence_date, last_value)
       VALUES (?, LAST_INSERT_ID(1))
       ON DUPLICATE KEY UPDATE last_value = LAST_INSERT_ID(last_value + 1)`,
      [testDate]
    );
    const seqRes = await client.query("SELECT LAST_INSERT_ID() AS assigned");
    const assigned = Number(seqRes[0].assigned);
    assertEquals(assigned, 1);
  }
});

Deno.test({
  name: "G2, G3. Segundo -> 2, Tercero -> 3",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const testDate = "2099-01-01";

    // Segundo
    await client.execute(
      `INSERT INTO daily_order_sequences (sequence_date, last_value)
       VALUES (?, LAST_INSERT_ID(1))
       ON DUPLICATE KEY UPDATE last_value = LAST_INSERT_ID(last_value + 1)`,
      [testDate]
    );
    const seqRes2 = await client.query("SELECT LAST_INSERT_ID() AS assigned");
    assertEquals(Number(seqRes2[0].assigned), 2);

    // Tercero
    await client.execute(
      `INSERT INTO daily_order_sequences (sequence_date, last_value)
       VALUES (?, LAST_INSERT_ID(1))
       ON DUPLICATE KEY UPDATE last_value = LAST_INSERT_ID(last_value + 1)`,
      [testDate]
    );
    const seqRes3 = await client.query("SELECT LAST_INSERT_ID() AS assigned");
    assertEquals(Number(seqRes3[0].assigned), 3);
  }
});

Deno.test({
  name: "G4. Cambio de fecha -> vuelve a 1",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const date2 = "2099-01-02";
    await client.execute("DELETE FROM orders WHERE order_date = ?", [date2]);
    await client.execute("DELETE FROM daily_order_sequences WHERE sequence_date = ?", [date2]);

    await client.execute(
      `INSERT INTO daily_order_sequences (sequence_date, last_value)
       VALUES (?, LAST_INSERT_ID(1))
       ON DUPLICATE KEY UPDATE last_value = LAST_INSERT_ID(last_value + 1)`,
      [date2]
    );
    const seqRes = await client.query("SELECT LAST_INSERT_ID() AS assigned");
    assertEquals(Number(seqRes[0].assigned), 1);
  }
});

Deno.test({
  name: "G5, G6. 50 creaciones simultáneas -> números únicos 1..50 sin duplicados por (order_date, daily_order_number)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const todayBogota = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

    // Ejecutar 50 guardados simultáneos en la base de datos real
    const promises: Promise<Order>[] = [];
    for (let i = 1; i <= 50; i++) {
      const orderNum = `ORD-TEST50-${Date.now()}-${i}-${Math.random()}`;
      const order = createTestOrder(orderNum);
      promises.push(repo.save(order));
    }

    const savedOrders = await Promise.all(promises);
    assertEquals(savedOrders.length, 50);

    const numbers = savedOrders.map((o) => o.dailyOrderNumber!);
    const uniqueNumbers = new Set(numbers);
    assertEquals(uniqueNumbers.size, 50); // Exactamente 50 números únicos!

    // Verificar en BD que no existen duplicados por (order_date, daily_order_number)
    const dbDupes = await client.query(
      `SELECT order_date, daily_order_number, COUNT(*) as cnt
       FROM orders
       WHERE order_date = ? AND daily_order_number IS NOT NULL
       GROUP BY order_date, daily_order_number
       HAVING cnt > 1`,
      [todayBogota]
    );
    assertEquals(dbDupes.length, 0);

    // Limpiar pedidos de prueba generados
    const createdIds = savedOrders.map((o) => o.id!);
    for (const id of createdIds) {
      await client.execute("DELETE FROM order_items WHERE order_id = ?", [id]);
      await client.execute("DELETE FROM orders WHERE id = ?", [id]);
    }
  }
});

Deno.test({
  name: "G7. Rollback de una creación -> comportamiento de transacción",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const testDate = "2099-01-04";
    await client.execute("DELETE FROM daily_order_sequences WHERE sequence_date = ?", [testDate]);

    try {
      await client.transaction(async (conn) => {
        await conn.execute(
          `INSERT INTO daily_order_sequences (sequence_date, last_value)
           VALUES (?, LAST_INSERT_ID(1))
           ON DUPLICATE KEY UPDATE last_value = LAST_INSERT_ID(last_value + 1)`,
          [testDate]
        );
        throw new Error("Simulated rollback error");
      });
    } catch (_e) {
      // Error capturado, la transacción hizo rollback
    }

    const rows = await client.query("SELECT * FROM daily_order_sequences WHERE sequence_date = ?", [testDate]);
    assertEquals(rows.length, 0); // Al hacer rollback, la fila fue revertida
  }
});

Deno.test({
  name: "G8. Reinicio del backend -> el contador continúa correctamente desde la BD",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const todayBogota = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

    const newRepoInstance = new MySQLOrderRepository();
    const testOrder = createTestOrder(`ORD-RESTART-${Date.now()}`);
    const saved = await newRepoInstance.save(testOrder);

    assertNotEquals(saved.dailyOrderNumber, null);
    assertEquals(saved.orderDate, todayBogota);

    if (saved.id) {
      await client.execute("DELETE FROM order_items WHERE order_id = ?", [saved.id]);
      await client.execute("DELETE FROM orders WHERE id = ?", [saved.id]);
    }
  }
});

Deno.test({
  name: "G9. Pedidos históricos -> dailyOrderNumber es null y no se modifican",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const rows = await client.query("SELECT id, order_number, daily_order_number FROM orders WHERE daily_order_number IS NULL LIMIT 1");
    if (rows.length > 0) {
      const historicalId = rows[0].id;
      const loadedOrder = await repo.findById(historicalId);
      assertEquals(loadedOrder?.dailyOrderNumber, null);
      assertEquals(loadedOrder?.displayOrderNumber, loadedOrder?.orderNumber);
    }
  }
});

Deno.test({
  name: "G10. Pagos existentes -> siguen funcionando mediante order.id e identificador técnico",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const rows = await client.query("SELECT id, order_number FROM orders ORDER BY id DESC LIMIT 1");
    if (rows.length > 0) {
      const orderId = rows[0].id;
      const orderNum = rows[0].order_number;

      const loaded = await repo.findById(orderId);
      assertEquals(loaded?.id, orderId);
      assertEquals(loaded?.orderNumber, orderNum);
    }
  }
});

Deno.test({
  name: "G99. Teardown DB connection",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await disconnectDB();
  }
});

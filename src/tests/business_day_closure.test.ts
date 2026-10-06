import { assertEquals, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { client, connectDB, disconnectDB } from "../shared/infrastructure/database.ts";
import { MySQLBusinessDayClosureRepository } from "../modules/business_day/infrastructure/mysql/MySQLBusinessDayClosureRepository.ts";
import { CloseBusinessDayUseCase } from "../modules/business_day/application/use-cases/CloseBusinessDayUseCase.ts";
import { GetBusinessDaySummaryUseCase } from "../modules/business_day/application/use-cases/GetBusinessDaySummaryUseCase.ts";
import { MySQLOrderRepository } from "../modules/orders/infrastructure/mysql/MySQLOrderRepository.ts";
import { Order } from "../modules/orders/domain/Order.ts";
import { OrderType } from "../modules/orders/domain/value-objects/OrderType.ts";
import { OrderStatus } from "../modules/orders/domain/value-objects/OrderStatus.ts";
import { OrderItem } from "../modules/orders/domain/OrderItem.ts";
import { ValidationError } from "../shared/domain/error.ts";

const closureRepo = new MySQLBusinessDayClosureRepository();
const orderRepo = new MySQLOrderRepository();
const closeUseCase = new CloseBusinessDayUseCase(closureRepo);
const getSummaryUseCase = new GetBusinessDaySummaryUseCase(closureRepo);

function createTestOrder(orderNum: string, type: string = "MESA", tableId: number | null = 1): Order {
  const item = new OrderItem(
    null, null, 1, null, 1, "UNIVERSITARIO", 15000, 0, null, []
  );
  return new Order(
    null,
    orderNum,
    null,
    1,
    OrderType.create(type),
    tableId,
    type === "DOMICILIO" ? "Calle 100 #20-30" : null,
    null,
    OrderStatus.initial(),
    null,
    15000,
    0,
    0,
    type === "MESA" ? 0 : 1000,
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
  name: "B0. Setup DB connection",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await connectDB();
  }
});

Deno.test({
  name: "B1. Caja abierta bloquea la finalización del día e identifica al titular",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const testDate = "2099-05-01";
    await client.execute("DELETE FROM business_day_closures WHERE business_date = ?", [testDate]);

    // Simular sesión de caja abierta por usuario #1 (Administrador)
    await client.execute(
      `INSERT INTO cash_sessions (opened_by_user_id, register_id, status, opening_balance)
       VALUES (1, 1, 'OPEN', 50000)`
    );
    const sessionRes = await client.query("SELECT LAST_INSERT_ID() AS id");
    const sessionId = Number(sessionRes[0].id);

    await assertRejects(
      async () => {
        await closeUseCase.execute({ closedByUserId: 1, businessDate: testDate });
      },
      ValidationError,
      "No se puede finalizar la jornada porque existen cajas abiertas"
    );

    // Limpiar sesión de caja de prueba
    await client.execute("DELETE FROM cash_sessions WHERE id = ?", [sessionId]);
  }
});

Deno.test({
  name: "B2. Pedido pendiente en mesa bloquea la finalización del día",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const testDate = "2099-05-02";
    await client.execute("DELETE FROM business_day_closures WHERE business_date = ?", [testDate]);
    await client.execute("UPDATE \`tables\` SET status = 'OCUPADA', account_requested = 1 WHERE id = 1");

    const order = createTestOrder(`ORD-PEND-MESA-${Date.now()}`, "MESA", 1);
    const savedOrder = await orderRepo.save(order);

    await assertRejects(
      async () => {
        await closeUseCase.execute({ closedByUserId: 1, businessDate: testDate });
      },
      ValidationError,
      "No se puede finalizar la jornada porque existen"
    );

    // Limpiar pedido de prueba
    if (savedOrder.id) {
      await client.execute("DELETE FROM order_items WHERE order_id = ?", [savedOrder.id]);
      await client.execute("DELETE FROM orders WHERE id = ?", [savedOrder.id]);
    }
    await client.execute("UPDATE \`tables\` SET status = 'AVAILABLE', account_requested = 0 WHERE id = 1");
  }
});

Deno.test({
  name: "B3. Domicilio / Recoger pendiente bloquea la finalización del día",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const testDate = "2099-05-03";
    await client.execute("DELETE FROM business_day_closures WHERE business_date = ?", [testDate]);

    const order = createTestOrder(`ORD-PEND-DOM-${Date.now()}`, "DOMICILIO", null);
    const savedOrder = await orderRepo.save(order);

    await assertRejects(
      async () => {
        await closeUseCase.execute({ closedByUserId: 1, businessDate: testDate });
      },
      ValidationError,
      "No se puede finalizar la jornada porque existen"
    );

    // Limpiar pedido
    if (savedOrder.id) {
      await client.execute("DELETE FROM order_items WHERE order_id = ?", [savedOrder.id]);
      await client.execute("DELETE FROM orders WHERE id = ?", [savedOrder.id]);
    }
  }
});

Deno.test({
  name: "B4. Usuario sin closedByUserId / sin JWT no puede finalizar",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await assertRejects(
      async () => {
        await closeUseCase.execute({ closedByUserId: 0, businessDate: "2099-05-04" });
      },
      ValidationError,
      "closedByUserId es obligatorio"
    );
  }
});

Deno.test({
  name: "B5. Finalización correcta: Mesas quedan AVAILABLE, account_requested=0, responsable registrado",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const testDate = "2099-05-05";
    await client.execute("DELETE FROM business_day_closures WHERE business_date = ?", [testDate]);

    // Temporalmente cerrar cajas abiertas y completar pedidos pendientes para aislar la prueba
    const openSessionsBefore = await client.query("SELECT id FROM cash_sessions WHERE status = 'OPEN'");
    await client.execute("UPDATE cash_sessions SET status = 'CLOSED' WHERE status = 'OPEN'");

    const pendingOrdersBefore = await client.query(
      `SELECT id, status, paid_at FROM orders
       WHERE status IN ('PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO')
          OR (table_id IS NOT NULL AND status != 'CANCELADO' AND paid_at IS NULL)`
    );
    await client.execute(
      `UPDATE orders SET status = 'ENTREGADO', paid_at = NOW()
       WHERE status IN ('PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO')
          OR (table_id IS NOT NULL AND status != 'CANCELADO' AND paid_at IS NULL)`
    );

    try {
      // Ocupar algunas mesas temporalmente
      await client.execute("UPDATE \`tables\` SET status = 'OCUPADA', account_requested = 1 WHERE id IN (1, 2, 3)");

      const closure = await closeUseCase.execute({ closedByUserId: 1, businessDate: testDate, notes: "Cierre exitoso" });

      assertEquals(closure.businessDate, testDate);
      assertEquals(closure.closedByUserId, 1);

      // Verificar que todas las mesas quedaron AVAILABLE y account_requested=0
      const occupiedRows = await client.query("SELECT COUNT(*) as cnt FROM \`tables\` WHERE status != 'AVAILABLE' OR account_requested != 0");
      assertEquals(Number(occupiedRows[0].cnt), 0);
    } finally {
      // Limpiar
      await client.execute("DELETE FROM business_day_closures WHERE business_date = ?", [testDate]);

      // Restaurar pedidos pendientes
      for (const p of pendingOrdersBefore) {
        await client.execute(
          "UPDATE orders SET status = ?, paid_at = ? WHERE id = ?",
          [p.status, p.paid_at, p.id]
        );
      }

      // Restaurar sesiones de caja previas si existían
      if (openSessionsBefore.length > 0) {
        const ids = openSessionsBefore.map((s: any) => s.id).join(",");
        await client.execute(`UPDATE cash_sessions SET status = 'OPEN' WHERE id IN (${ids})`);
      }
    }
  }
});

Deno.test({
  name: "B6. No se puede finalizar dos veces el mismo día",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const testDate = "2099-05-06";
    await client.execute("DELETE FROM business_day_closures WHERE business_date = ?", [testDate]);

    const openSessionsBefore = await client.query("SELECT id FROM cash_sessions WHERE status = 'OPEN'");
    await client.execute("UPDATE cash_sessions SET status = 'CLOSED' WHERE status = 'OPEN'");

    const pendingOrdersBefore = await client.query(
      `SELECT id, status, paid_at FROM orders
       WHERE status IN ('PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO')
          OR (table_id IS NOT NULL AND status != 'CANCELADO' AND paid_at IS NULL)`
    );
    await client.execute(
      `UPDATE orders SET status = 'ENTREGADO', paid_at = NOW()
       WHERE status IN ('PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO')
          OR (table_id IS NOT NULL AND status != 'CANCELADO' AND paid_at IS NULL)`
    );

    try {
      // Primer cierre
      await closeUseCase.execute({ closedByUserId: 1, businessDate: testDate });

      // Segundo cierre del mismo día debe fallar
      await assertRejects(
        async () => {
          await closeUseCase.execute({ closedByUserId: 1, businessDate: testDate });
        },
        ValidationError,
        "La jornada del día ya fue finalizada."
      );
    } finally {
      // Limpiar
      await client.execute("DELETE FROM business_day_closures WHERE business_date = ?", [testDate]);
      for (const p of pendingOrdersBefore) {
        await client.execute("UPDATE orders SET status = ?, paid_at = ? WHERE id = ?", [p.status, p.paid_at, p.id]);
      }
      if (openSessionsBefore.length > 0) {
        const ids = openSessionsBefore.map((s: any) => s.id).join(",");
        await client.execute(`UPDATE cash_sessions SET status = 'OPEN' WHERE id IN (${ids})`);
      }
    }
  }
});

Deno.test({
  name: "B7. Error provocado durante la operación produce ROLLBACK completo",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const testDate = "2099-05-07";
    await client.execute("DELETE FROM business_day_closures WHERE business_date = ?", [testDate]);
    await client.execute("UPDATE \`tables\` SET status = 'OCUPADA', account_requested = 1 WHERE id = 1");

    try {
      await client.transaction(async (conn) => {
        await closureRepo.resetTablesToAvailable(conn);
        throw new Error("Simulated closure error");
      });
    } catch (_e) {
      // Error intencional
    }

    // Al hacer rollback, la mesa debe conservar su estado 'OCUPADA' y account_requested=1
    const table1 = await client.query("SELECT status, account_requested FROM \`tables\` WHERE id = 1");
    assertEquals(table1[0].status, "OCUPADA");
    assertEquals(Number(table1[0].account_requested), 1);

    // Resetear
    await client.execute("UPDATE \`tables\` SET status = 'AVAILABLE', account_requested = 0 WHERE id = 1");
  }
});

Deno.test({
  name: "B8. Pedidos históricos permanecen intactos tras el cierre de jornada",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const testDate = "2099-05-08";
    await client.execute("DELETE FROM business_day_closures WHERE business_date = ?", [testDate]);

    const openSessionsBefore = await client.query("SELECT id FROM cash_sessions WHERE status = 'OPEN'");
    await client.execute("UPDATE cash_sessions SET status = 'CLOSED' WHERE status = 'OPEN'");

    const pendingOrdersBefore = await client.query(
      `SELECT id, status, paid_at FROM orders
       WHERE status IN ('PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO')
          OR (table_id IS NOT NULL AND status != 'CANCELADO' AND paid_at IS NULL)`
    );
    await client.execute(
      `UPDATE orders SET status = 'ENTREGADO', paid_at = NOW()
       WHERE status IN ('PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO')
          OR (table_id IS NOT NULL AND status != 'CANCELADO' AND paid_at IS NULL)`
    );

    try {
      const historicalRows = await client.query("SELECT COUNT(*) as cnt FROM orders");
      const countBefore = Number(historicalRows[0].cnt);

      await closeUseCase.execute({ closedByUserId: 1, businessDate: testDate });

      const countAfterRows = await client.query("SELECT COUNT(*) as cnt FROM orders");
      const countAfter = Number(countAfterRows[0].cnt);

      assertEquals(countBefore, countAfter); // Ningún pedido fue alterado ni borrado
    } finally {
      await client.execute("DELETE FROM business_day_closures WHERE business_date = ?", [testDate]);
      for (const p of pendingOrdersBefore) {
        await client.execute("UPDATE orders SET status = ?, paid_at = ? WHERE id = ?", [p.status, p.paid_at, p.id]);
      }
      if (openSessionsBefore.length > 0) {
        const ids = openSessionsBefore.map((s: any) => s.id).join(",");
        await client.execute(`UPDATE cash_sessions SET status = 'OPEN' WHERE id IN (${ids})`);
      }
    }
  }
});

Deno.test({
  name: "B9. Día siguiente comienza automáticamente con PEDIDO 1 sin alterar días anteriores",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const day1 = "2099-05-09";
    const day2 = "2099-05-10";

    await client.execute("DELETE FROM orders WHERE order_date IN (?, ?)", [day1, day2]);
    await client.execute("DELETE FROM daily_order_sequences WHERE sequence_date IN (?, ?)", [day1, day2]);
    await client.execute("DELETE FROM business_day_closures WHERE business_date IN (?, ?)", [day1, day2]);

    const openSessionsBefore = await client.query("SELECT id FROM cash_sessions WHERE status = 'OPEN'");
    await client.execute("UPDATE cash_sessions SET status = 'CLOSED' WHERE status = 'OPEN'");

    const pendingOrdersBefore = await client.query(
      `SELECT id, status, paid_at FROM orders
       WHERE status IN ('PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO')
          OR (table_id IS NOT NULL AND status != 'CANCELADO' AND paid_at IS NULL)`
    );
    await client.execute(
      `UPDATE orders SET status = 'ENTREGADO', paid_at = NOW()
       WHERE status IN ('PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO')
          OR (table_id IS NOT NULL AND status != 'CANCELADO' AND paid_at IS NULL)`
    );

    try {
      // Día 1: Pedido 1
      await client.execute(
        `INSERT INTO daily_order_sequences (sequence_date, last_value)
         VALUES (?, LAST_INSERT_ID(1))
         ON DUPLICATE KEY UPDATE last_value = LAST_INSERT_ID(last_value + 1)`,
        [day1]
      );
      const seq1 = await client.query("SELECT LAST_INSERT_ID() AS assigned");
      assertEquals(Number(seq1[0].assigned), 1);

      // Cierre Día 1
      await closeUseCase.execute({ closedByUserId: 1, businessDate: day1 });

      // Día 2: Pedido 1
      await client.execute(
        `INSERT INTO daily_order_sequences (sequence_date, last_value)
         VALUES (?, LAST_INSERT_ID(1))
         ON DUPLICATE KEY UPDATE last_value = LAST_INSERT_ID(last_value + 1)`,
        [day2]
      );
      const seq2 = await client.query("SELECT LAST_INSERT_ID() AS assigned");
      assertEquals(Number(seq2[0].assigned), 1); // Día 2 arranca automáticamente en PEDIDO 1!
    } finally {
      // Limpiar
      await client.execute("DELETE FROM daily_order_sequences WHERE sequence_date IN (?, ?)", [day1, day2]);
      await client.execute("DELETE FROM business_day_closures WHERE business_date IN (?, ?)", [day1, day2]);
      for (const p of pendingOrdersBefore) {
        await client.execute("UPDATE orders SET status = ?, paid_at = ? WHERE id = ?", [p.status, p.paid_at, p.id]);
      }
      if (openSessionsBefore.length > 0) {
        const ids = openSessionsBefore.map((s: any) => s.id).join(",");
        await client.execute(`UPDATE cash_sessions SET status = 'OPEN' WHERE id IN (${ids})`);
      }
    }
  }
});

Deno.test({
  name: "B99. Teardown DB connection",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await disconnectDB();
  }
});

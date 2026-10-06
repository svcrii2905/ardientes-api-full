import { connectDB, client, disconnectDB } from "./shared/infrastructure/database.ts";
import { migrateBlock4 } from "./migrate-block4.ts";
import { tableRepository, getTablesUseCase, getTableOrdersUseCase, createTableOrderUseCase, releaseTableUseCase, transferTableUseCase, requestTableAccountUseCase } from "./modules/tables/infrastructure/dependencies.ts";
import { createOrderUseCase } from "./modules/orders/infrastructure/dependencies.ts";
import { processPaymentUseCase } from "./modules/payments/infrastructure/dependencies.ts";
import { ValidationError } from "./shared/domain/error.ts";

async function runBlock4Tests() {
  try {
    await connectDB();
    console.log("🧪 Iniciando pruebas automatizadas del Bloque 4 (Mesero + Gestión de Mesas)...\n");

    // ── TEST 1: GET de mesas devuelve exactamente 7 mesas físicas ─────────────
    console.log("--- TEST 1: GET de mesas devuelve exactamente 7 mesas físicas ---");
    const tables = await getTablesUseCase.execute();
    console.log(`✅ Mesas obtenidas: ${tables.length}`);
    if (tables.length !== 7) {
      throw new Error(`Se esperaban exactamente 7 mesas, pero se obtuvieron ${tables.length}`);
    }
    const names = tables.map((t) => t.table.name);
    console.log("   Mesas:", names.join(", "));
    for (let i = 1; i <= 7; i++) {
      if (!names.includes(`MESA ${i}`)) {
        throw new Error(`Falta la MESA ${i}`);
      }
    }
    console.log("✅ OK: Las 7 mesas físicas están presentes (MESA 1 a MESA 7)");

    // ── TEST 2: Idempotencia de migración/seed ────────────────────────────────
    console.log("\n--- TEST 2: Idempotencia de la migración y seed ---");
    await migrateBlock4();
    const tablesAfter = await getTablesUseCase.execute();
    if (tablesAfter.length !== 7) {
      throw new Error(`Tras re-ejecutar migración se esperaban 7 mesas, pero hay ${tablesAfter.length}`);
    }
    console.log("✅ OK: La migración es 100% idempotente y no duplica ni elimina mesas");

    // ── TEST 3: Mesa libre + creación correcta de pedido MESA: LIBRE → OCUPADA ─
    console.log("\n--- TEST 3: Mesa libre + creación de pedido MESA: LIBRE → OCUPADA ---");
    // Tomamos MESA 2 (para no colisionar con MESA 1 usada en órdenes anteriores)
    const mesa2 = await tableRepository.findByNumber(2);
    if (!mesa2) throw new Error("MESA 2 no encontrada");

    // Asegurar que MESA 2 comience limpia y LIBRE
    await client.query("UPDATE orders SET status = 'CANCELADO' WHERE table_id = ? AND paid_at IS NULL", [mesa2.id]);
    await tableRepository.updateStatus(mesa2.id, "LIBRE");
    await tableRepository.updateAccountRequested(mesa2.id, false);

    const order1 = await createTableOrderUseCase.execute({
      tableId: mesa2.id,
      userId: 1,
      items: [
        {
          productId: 1, // Desnudita (Universitario)
          quantity: 1,
          menuType: "UNIVERSITARIO",
        },
      ],
    });

    console.log(`✅ Pedido #${order1.orderNumber} creado en ${mesa2.name} (ID: ${order1.id})`);
    const mesa2AfterOrder1 = await tableRepository.findById(mesa2.id);
    if (!mesa2AfterOrder1?.isOcupada()) {
      throw new Error(`Se esperaba que ${mesa2.name} estuviera OCUPADA, pero está ${mesa2AfterOrder1?.status}`);
    }
    console.log(`✅ OK: ${mesa2.name} pasó de LIBRE a OCUPADA tras persistencia`);

    // ── TEST 4: Crear un segundo pedido para la misma mesa: sigue OCUPADA ─────
    console.log("\n--- TEST 4: Segundo pedido para la misma mesa ---");
    const order2 = await createTableOrderUseCase.execute({
      tableId: mesa2.id,
      userId: 1,
      items: [
        {
          productId: 59, // Desnudita (Especial)
          quantity: 1,
          menuType: "ESPECIAL",
        },
      ],
    });
    console.log(`✅ Segundo pedido #${order2.orderNumber} creado en ${mesa2.name} (ID: ${order2.id})`);
    const mesa2AfterOrder2 = await tableRepository.findById(mesa2.id);
    if (!mesa2AfterOrder2?.isOcupada()) {
      throw new Error(`Se esperaba que ${mesa2.name} siguiera OCUPADA`);
    }
    console.log(`✅ OK: ${mesa2.name} continúa OCUPADA`);

    // ── TEST 5: Intento de crear pedido inválido: falla y mesa no muta erróneamente ──
    console.log("\n--- TEST 5: Crear pedido inválido no muta estado ---");
    let invalidCaught = false;
    try {
      await createTableOrderUseCase.execute({
        tableId: mesa2.id,
        userId: 1,
        items: [
          {
            productId: 999999, // Producto inexistente
            quantity: 1,
            menuType: "UNIVERSITARIO",
          },
        ],
      });
    } catch (_err) {
      invalidCaught = true;
    }
    if (!invalidCaught) {
      throw new Error("El pedido con producto inválido debió fallar");
    }
    const mesa2AfterInvalid = await tableRepository.findById(mesa2.id);
    if (!mesa2AfterInvalid?.isOcupada()) {
      throw new Error("El estado de la mesa mutó erróneamente tras un fallo");
    }
    console.log("✅ OK: Operación inválida rechazada correctamente sin inconsistencias");

    // ── TEST 6: Consultar pedidos de una mesa devuelve solo los correspondientes ──
    console.log("\n--- TEST 6: Consultar pedidos de una mesa ---");
    const ordersMesa2 = await getTableOrdersUseCase.execute(mesa2.id, true);
    console.log(`   Pedidos encontrados para ${mesa2.name}: ${ordersMesa2.length}`);
    const orderIds = ordersMesa2.map((o) => o.id);
    if (!orderIds.includes(order1.id) || !orderIds.includes(order2.id)) {
      throw new Error("No se encontraron los dos pedidos creados para la MESA 2");
    }
    console.log("✅ OK: Los pedidos corresponden fielmente a la mesa");

    // ── TEST 7: Mesa con pedidos pendientes NO puede quedar LIBRE ─────────────
    console.log("\n--- TEST 7: Intentar liberar mesa con pedidos pendientes ---");
    let releaseErrorCaught = false;
    try {
      await releaseTableUseCase.execute(mesa2.id);
    } catch (err: any) {
      if (err instanceof ValidationError) {
        releaseErrorCaught = true;
        console.log(`✅ OK: Intento de liberación rechazado correctamente: "${err.message}"`);
      }
    }
    if (!releaseErrorCaught) {
      throw new Error("La mesa con pedidos pendientes no debió poder liberarse");
    }

    // ── TEST 8: Solicitar cuenta y luego pagar pedidos: OCUPADA → LIBRE ───────
    console.log("\n--- TEST 8: Solicitar cuenta y pago completo: OCUPADA → LIBRE ---");
    await requestTableAccountUseCase.execute(mesa2.id);
    const mesa2WithBill = await tableRepository.findById(mesa2.id);
    if (!mesa2WithBill?.accountRequested) {
      throw new Error("Se esperaba accountRequested = true");
    }
    console.log(`✅ OK: Cuenta solicitada registrada para ${mesa2.name}`);

    // Abrir o reutilizar sesión de caja para pagar
    const openSessions = await client.query("SELECT id FROM cash_sessions WHERE status = 'OPEN' LIMIT 1");
    let sessionId: number;
    if (openSessions.length === 0) {
      const newSession = await client.execute(
        "INSERT INTO cash_sessions (opened_by_user_id, register_id, status, opening_balance) VALUES (1, 1, 'OPEN', 100000)"
      );
      sessionId = newSession.lastInsertId!;
    } else {
      sessionId = openSessions[0].id;
    }

    // Pagar pedido 1
    await processPaymentUseCase.execute({
      orderId: order1.id!,
      paymentMethodId: 1, // Efectivo
      sessionId,
      amount: order1.total,
      performedBy: 1,
    });

    // MESA 2 todavía tiene order2 pendiente -> debe seguir OCUPADA
    const mesa2AfterPayment1 = await tableRepository.findById(mesa2.id);
    if (!mesa2AfterPayment1?.isOcupada()) {
      throw new Error(`Se esperaba que ${mesa2.name} siguiera OCUPADA porque aún falta pagar order2`);
    }
    console.log(`✅ OK: ${mesa2.name} sigue OCUPADA con 1 pedido pendiente restante`);

    // Pagar pedido 2 (último pedido pendiente)
    await processPaymentUseCase.execute({
      orderId: order2.id!,
      paymentMethodId: 1, // Efectivo
      sessionId,
      amount: order2.total,
      performedBy: 1,
    });

    // Ahora MESA 2 no tiene pedidos pendientes -> debe estar LIBRE y accountRequested en false
    const mesa2Freed = await tableRepository.findById(mesa2.id);
    if (!mesa2Freed?.isLibre() || mesa2Freed.accountRequested) {
      throw new Error(`Se esperaba que ${mesa2.name} pasara a LIBRE tras liquidar todos sus pedidos`);
    }
    console.log(`✅ OK: ${mesa2.name} pasó automáticamente a LIBRE tras pagar todos sus pedidos`);

    // ── TEST 9: Pedidos DOMICILIO y RECOGER siguen funcionando sin tableId ────
    console.log("\n--- TEST 9: Pedidos DOMICILIO y RECOGER sin tableId ---");
    const orderRecoger = await createOrderUseCase.execute({
      userId: 1,
      orderType: "RECOGER",
      items: [{ productId: 1, quantity: 1, menuType: "UNIVERSITARIO" }],
    });
    if (orderRecoger.tableId !== null) {
      throw new Error("Pedido RECOGER no debe tener tableId");
    }
    console.log(`✅ OK: Pedido RECOGER #${orderRecoger.orderNumber} creado sin tableId`);

    const orderDomicilio = await createOrderUseCase.execute({
      userId: 1,
      orderType: "DOMICILIO",
      deliveryAddress: "Calle 100 # 15-20",
      items: [{ productId: 1, quantity: 1, menuType: "UNIVERSITARIO" }],
    });
    if (orderDomicilio.tableId !== null) {
      throw new Error("Pedido DOMICILIO no debe tener tableId");
    }
    console.log(`✅ OK: Pedido DOMICILIO #${orderDomicilio.orderNumber} creado sin tableId`);

    // ── TEST 10: Cambiar de Mesa (TransferTableUseCase) ──────────────────────
    console.log("\n--- TEST 10: Cambiar de Mesa (Traslado de pedidos activos) ---");
    const mesa3 = await tableRepository.findByNumber(3);
    const mesa4 = await tableRepository.findByNumber(4);
    if (!mesa3 || !mesa4) throw new Error("MESA 3 o MESA 4 no encontradas");

    // Limpiar estados
    await tableRepository.updateStatus(mesa3.id, "LIBRE");
    await tableRepository.updateStatus(mesa4.id, "LIBRE");

    // Crear pedido en MESA 3
    const orderMesa3 = await createTableOrderUseCase.execute({
      tableId: mesa3.id,
      userId: 1,
      items: [{ productId: 1, quantity: 1, menuType: "UNIVERSITARIO" }],
    });

    console.log(`   Pedido #${orderMesa3.orderNumber} creado en ${mesa3.name}`);
    // Trasladar pedidos de MESA 3 a MESA 4
    await transferTableUseCase.execute(mesa3.id, mesa4.id);

    const mesa3AfterTransfer = await tableRepository.findById(mesa3.id);
    const mesa4AfterTransfer = await tableRepository.findById(mesa4.id);

    if (!mesa3AfterTransfer?.isLibre()) {
      throw new Error(`Se esperaba que ${mesa3.name} quedara LIBRE tras el traslado`);
    }
    if (!mesa4AfterTransfer?.isOcupada()) {
      throw new Error(`Se esperaba que ${mesa4.name} quedara OCUPADA tras recibir el traslado`);
    }

    const ordersInMesa4 = await getTableOrdersUseCase.execute(mesa4.id, true);
    if (!ordersInMesa4.some((o) => o.id === orderMesa3.id)) {
      throw new Error("El pedido no fue reasignado a la mesa destino");
    }
    console.log(`✅ OK: Pedido transferido exitosamente de ${mesa3.name} (ahora LIBRE) a ${mesa4.name} (ahora OCUPADA)`);

    console.log("\n🎉 TODAS LAS PRUEBAS DEL BLOQUE 4 (MESERO + GESTIÓN DE MESAS) PASARON CON ÉXITO.\n");
  } catch (err) {
    console.error("❌ Error en pruebas de Bloque 4:", err);
    Deno.exit(1);
  } finally {
    await disconnectDB();
  }
}

if (import.meta.main) {
  runBlock4Tests();
}

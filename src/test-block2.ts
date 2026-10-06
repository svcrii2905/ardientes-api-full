import { connectDB, disconnectDB, client } from "./shared/infrastructure/database.ts";
import { createOrderUseCase, changeOrderStatusUseCase, getKitchenOrdersUseCase } from "./modules/orders/infrastructure/dependencies.ts";
import { ValidationError } from "./shared/domain/error.ts";

async function runTests() {
  console.log("🧪 Iniciando pruebas automatizadas del Bloque 2 (KDS / Cocina)...");
  await connectDB();

  try {
    // 1. Crear un pedido de prueba (MESA)
    console.log("\n--- TEST 1: Crear pedido y verificar kitchen_started_at inicial en null ---");
    const testOrder = await createOrderUseCase.execute({
      userId: 1,
      orderType: "MESA",
      tableId: 1,
      items: [
        {
          productId: 1, // Hamburguesa Clásica
          quantity: 2,
          menuType: "UNIVERSITARIO",
          notes: "Término medio, sin cebolla",
          toppings: [
            { toppingId: 1, quantity: 1 } // Tocineta
          ]
        }
      ],
      beverages: [
        { beverageId: 1, quantity: 1 } // Coca Cola
      ],
      notes: "Cliente especial mesa 1"
    });

    console.log(`✅ Pedido #${testOrder.orderNumber} creado con ID: ${testOrder.id}, Estado: ${testOrder.status.value}`);
    if (testOrder.kitchenStartedAt !== null) {
      throw new Error(`Esperado kitchenStartedAt null en PENDIENTE, pero fue: ${testOrder.kitchenStartedAt}`);
    }
    console.log("✅ OK: kitchenStartedAt es null en estado PENDIENTE");

    // 2. Transicionar a CONFIRMADO (ingreso a cocina)
    console.log("\n--- TEST 2: Transicionar a CONFIRMADO y verificar registro de kitchen_started_at ---");
    const confirmedOrder = await changeOrderStatusUseCase.execute({
      orderId: testOrder.id!,
      newStatus: "CONFIRMADO",
      changedBy: 1,
      notes: "Pedido pagado y enviado a cocina"
    });

    if (!confirmedOrder.kitchenStartedAt) {
      throw new Error("Esperado que kitchenStartedAt se establezca al pasar a CONFIRMADO");
    }
    console.log(`✅ OK: Pedido confirmado, kitchenStartedAt registrado: ${confirmedOrder.kitchenStartedAt.toISOString()}`);

    // Verificar en BD directamente
    const [row] = await client.query(`SELECT status, kitchen_started_at FROM orders WHERE id = ?`, [testOrder.id]);
    if (!row.kitchen_started_at) {
      throw new Error("El campo kitchen_started_at no fue persistido en MySQL!");
    }
    console.log(`✅ OK: Persistencia verificada en BD: ${row.kitchen_started_at}`);

    // 3. Regla de seguridad: rechazar DEMORADO
    console.log("\n--- TEST 3: Regla de seguridad — Rechazar estado 'DEMORADO' ---");
    let securityPassed = false;
    try {
      await changeOrderStatusUseCase.execute({
        orderId: testOrder.id!,
        newStatus: "DEMORADO",
        changedBy: 1
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        console.log(`✅ OK: Estado 'DEMORADO' rechazado correctamente con ValidationError: "${err.message}"`);
        securityPassed = true;
      } else {
        throw err;
      }
    }
    if (!securityPassed) {
      throw new Error("FALLO: El backend debió rechazar el estado DEMORADO pero no lo hizo.");
    }

    // 4. Transicionar a EN_PREPARACION y verificar que NO se resetea kitchen_started_at
    console.log("\n--- TEST 4: Transicionar a EN_PREPARACION y verificar inmutabilidad del timestamp inicial ---");
    const initialTimestamp = new Date(row.kitchen_started_at).getTime();
    
    // Esperar 1 segundo para asegurar diferencia si se recalculase
    await new Promise((r) => setTimeout(r, 1000));

    const prepOrder = await changeOrderStatusUseCase.execute({
      orderId: testOrder.id!,
      newStatus: "EN_PREPARACION",
      changedBy: 1,
      notes: "Cocinero inició preparación"
    });

    const prepTimestamp = new Date(prepOrder.kitchenStartedAt!).getTime();
    if (Math.abs(prepTimestamp - initialTimestamp) > 1000) {
      throw new Error(`kitchenStartedAt cambió indebidamente: inicial ${initialTimestamp} vs prep ${prepTimestamp}`);
    }
    console.log(`✅ OK: kitchenStartedAt se conservó idéntico (${prepOrder.kitchenStartedAt?.toISOString()})`);

    // 5. Consultar GetKitchenOrdersUseCase y verificar carga de productos, toppings y bebidas
    console.log("\n--- TEST 5: Consultar pedidos para KDS vía GetKitchenOrdersUseCase ---");
    const kitchenOrders = await getKitchenOrdersUseCase.execute({ activeOnly: true });
    const found = kitchenOrders.find((o) => o.id === testOrder.id);
    if (!found) {
      throw new Error(`Pedido #${testOrder.id} no encontrado en la lista de cocina activa`);
    }
    console.log(`✅ OK: Pedido #${found.orderNumber} encontrado en KDS`);
    console.log(`   - Ítems: ${found.items.length}`);
    if (found.items.length > 0) {
      console.log(`   - Producto: ${found.items[0].productName} (Cantidad: ${found.items[0].quantity})`);
      console.log(`   - Toppings: ${found.items[0].toppings.map((t) => t.toppingName).join(", ")}`);
      if (!found.items[0].productName) {
        throw new Error("El productName no fue resuelto correctamente en el ítem de pedido");
      }
    }
    if (found.beverages.length > 0) {
      console.log(`   - Bebida: ${found.beverages[0].beverageName} (Cantidad: ${found.beverages[0].quantity})`);
      if (!found.beverages[0].beverageName) {
        throw new Error("El beverageName no fue resuelto correctamente en la bebida de pedido");
      }
    }

    // 6. Transicionar a LISTO y ENTREGADO
    console.log("\n--- TEST 6: Transición a LISTO y ENTREGADO (ciclo terminal) ---");
    await changeOrderStatusUseCase.execute({
      orderId: testOrder.id!,
      newStatus: "LISTO",
      changedBy: 1,
      notes: "Pedido listo para entrega"
    });
    console.log("✅ OK: Pedido marcado como LISTO");

    const kitchenOrdersAfterReady = await getKitchenOrdersUseCase.execute({ activeOnly: true });
    const foundInActive = kitchenOrdersAfterReady.find((o) => o.id === testOrder.id);
    if (foundInActive) {
      throw new Error("Un pedido LISTO no debería figurar en activeOnly: true de cocina");
    }
    console.log("✅ OK: Pedido en estado LISTO ya no figura en pedidos pendientes activos de cocina");

    await changeOrderStatusUseCase.execute({
      orderId: testOrder.id!,
      newStatus: "ENTREGADO",
      changedBy: 1,
      notes: "Entregado a la mesa"
    });
    console.log("✅ OK: Pedido marcado como ENTREGADO");

    console.log("\n🎉 TODAS LAS PRUEBAS DEL BLOQUE 2 (KDS / COCINA) PASARON CON ÉXITO.\n");
    await disconnectDB();
  } catch (err) {
    console.error("❌ Error en pruebas de Bloque 2:", err);
    try { await disconnectDB(); } catch { /* ignore */ }
    Deno.exit(1);
  }
}

if (import.meta.main) {
  runTests();
}

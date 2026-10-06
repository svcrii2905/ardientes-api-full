import { connectDB, client, disconnectDB, transactionManager } from "./shared/infrastructure/database.ts";
import { MySQLOrderRepository } from "./modules/orders/infrastructure/mysql/MySQLOrderRepository.ts";
import { MySQLMenuToppingRuleRepository } from "./modules/orders/infrastructure/mysql/MySQLMenuToppingRuleRepository.ts";
import { MySQLCatalogQueryAdapter } from "./modules/orders/infrastructure/mysql/MySQLCatalogQueryAdapter.ts";
import { CreateOrderUseCase } from "./modules/orders/application/use-cases/CreateOrderUseCase.ts";
import { MySQLOrderPaymentRepository } from "./modules/payments/infrastructure/mysql/MySQLOrderPaymentRepository.ts";
import { MySQLPaymentMethodRepository } from "./modules/payments/infrastructure/mysql/MySQLPaymentMethodRepository.ts";
import { MySQLPaymentOrderQueryAdapter } from "./modules/payments/infrastructure/mysql/MySQLPaymentOrderQueryAdapter.ts";
import { ProcessPaymentUseCase } from "./modules/payments/application/use-cases/ProcessPaymentUseCase.ts";
import { MySQLCustomerRepository } from "./modules/customers/infrastructure/mysql/MySQLCustomerRepository.ts";
import { RedeemPointsUseCase } from "./modules/customers/application/use-cases/RedeemPointsUseCase.ts";
import { GetCustomerLoyaltyUseCase } from "./modules/customers/application/use-cases/GetCustomerLoyaltyUseCase.ts";

async function runTests() {
  try {
    await connectDB();
    console.log("🧪 Iniciando pruebas automáticas de validación del Primer Bloque...\n");

    // ── TEST 1: Catálogo de Hamburguesas (Universitarias y Especiales) ────────
    console.log("👉 TEST 1: Verificando coexistencia de Hamburguesas Universitarias y Especiales...");
    const uniBurgers = await client.query(
      "SELECT id, name, price_universitario, available_in FROM products WHERE category_id = 1 AND available_in = 'UNIVERSITARIO' ORDER BY id"
    );
    console.log(`   Hamburguesas Universitarias encontradas: ${uniBurgers.length}`);
    if (uniBurgers.length < 7) throw new Error("Faltan hamburguesas universitarias");
    console.log(`   Ejemplo: ID ${uniBurgers[0].id} - ${uniBurgers[0].name} ($${uniBurgers[0].price_universitario}) [${uniBurgers[0].available_in}]`);

    const espBurgers = await client.query(
      "SELECT id, name, price_especial, available_in FROM products WHERE category_id = 1 AND available_in = 'ESPECIAL' ORDER BY id"
    );
    console.log(`   Hamburguesas Especiales encontradas: ${espBurgers.length}`);
    if (espBurgers.length < 6) throw new Error("Faltan hamburguesas especiales");
    console.log(`   Ejemplo: ID ${espBurgers[0].id} - ${espBurgers[0].name} ($${espBurgers[0].price_especial}) [${espBurgers[0].available_in}]`);
    console.log("   ✅ TEST 1 PASÓ: Coexistencia correcta sin sobreescrituras.\n");

    // Instanciar repositorios y casos de uso
    const orderRepo = new MySQLOrderRepository();
    const menuRuleRepo = new MySQLMenuToppingRuleRepository();
    const catalogPorts = new MySQLCatalogQueryAdapter();
    const createOrderUseCase = new CreateOrderUseCase(orderRepo, menuRuleRepo, catalogPorts);

    const paymentRepo = new MySQLOrderPaymentRepository();
    const paymentMethodRepo = new MySQLPaymentMethodRepository();
    const paymentQueryPorts = new MySQLPaymentOrderQueryAdapter();
    const processPaymentUseCase = new ProcessPaymentUseCase(
      paymentRepo,
      paymentMethodRepo,
      paymentQueryPorts,
      transactionManager
    );

    const customerRepo = new MySQLCustomerRepository();
    const redeemPointsUseCase = new RedeemPointsUseCase(customerRepo, transactionManager);
    const getLoyaltyUseCase = new GetCustomerLoyaltyUseCase(customerRepo);

    // ── TEST 2: Pedido tipo MESA -> Desechables = $0 ─────────────────────────
    console.log("👉 TEST 2: Creando pedido tipo MESA (esperado: disposable_fee = $0)...");
    const mesaOrder = await createOrderUseCase.execute({
      userId: 1,
      orderType: "MESA",
      tableId: 1,
      items: [
        {
          productId: 1, // Desnudita universitaria ($7.000)
          quantity: 1,
          menuType: "UNIVERSITARIO",
        }
      ]
    });
    console.log(`   Pedido #${mesaOrder.orderNumber} creado. Subtotal: $${mesaOrder.subtotal}, Desechables: $${mesaOrder.disposableFee}, Total: $${mesaOrder.total}`);
    if (mesaOrder.disposableFee !== 0) throw new Error(`Desechables debió ser 0 pero fue ${mesaOrder.disposableFee}`);
    if (mesaOrder.total !== 7000) throw new Error(`Total debió ser 7000 pero fue ${mesaOrder.total}`);
    console.log("   ✅ TEST 2 PASÓ: MESA tiene $0 de desechables.\n");

    // ── TEST 3: Pedido tipo RECOGER (Para llevar) -> Desechables = $1.000 ────
    console.log("👉 TEST 3: Creando pedido tipo RECOGER (esperado: disposable_fee = $1.000)...");
    const recogerOrder = await createOrderUseCase.execute({
      userId: 1,
      orderType: "RECOGER",
      items: [
        {
          productId: 59, // Desnudita especial ($15.000)
          quantity: 1,
          menuType: "ESPECIAL",
        }
      ]
    });
    console.log(`   Pedido #${recogerOrder.orderNumber} creado. Subtotal: $${recogerOrder.subtotal}, Desechables: $${recogerOrder.disposableFee}, Total: $${recogerOrder.total}`);
    if (recogerOrder.disposableFee !== 1000) throw new Error(`Desechables debió ser 1000 pero fue ${recogerOrder.disposableFee}`);
    if (recogerOrder.total !== 16000) throw new Error(`Total debió ser 16000 ($15.000 + $1.000) pero fue ${recogerOrder.total}`);
    console.log("   ✅ TEST 3 PASÓ: RECOGER tiene $1.000 de desechables correctamente cargados.\n");

    // ── TEST 4: Cliente, Pago y Acumulación de Puntos ─────────────────────────
    console.log("👉 TEST 4: Verificando fidelización con cliente identificado...");
    // Buscar o crear cliente de prueba
    let testCustomer = await customerRepo.findByPhone("3110001122");
    if (!testCustomer) {
      testCustomer = await customerRepo.save(
        new (await import("./modules/customers/domain/Customer.ts")).Customer(
          null,
          "Cliente Fidelidad Test",
          "3110001122",
          "fidelidad@test.com",
          "Carrera 7 # 45-10",
          9, // 9 puntos iniciales
          0,
          0
        )
      );
    } else {
      testCustomer.loyaltyPoints = 9;
      await customerRepo.update(testCustomer);
    }

    console.log(`   Cliente inicial: ${testCustomer.fullName}, Puntos: ${testCustomer.loyaltyPoints}`);

    // Crear pedido con este cliente
    const loyaltyOrder = await createOrderUseCase.execute({
      userId: 1,
      orderType: "RECOGER",
      customerId: testCustomer.id!,
      items: [
        {
          productId: 60, // Doble Placer Especial ($17.000)
          quantity: 1,
          menuType: "ESPECIAL",
        }
      ]
    });
    console.log(`   Pedido para cliente creado: #${loyaltyOrder.orderNumber}, Total: $${loyaltyOrder.total}`);

    // Asegurar que hay una sesión de caja abierta para registrar el pago
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

    // Procesar pago total
    console.log("   Procesando pago del pedido...");
    await processPaymentUseCase.execute({
      orderId: loyaltyOrder.id!,
      paymentMethodId: 1, // Efectivo
      sessionId,
      amount: loyaltyOrder.total,
      changeAmount: 0,
      performedBy: 1,
    });

    // Verificar cliente actualizado (+1 punto) -> ahora debe tener 10 puntos (9 + 1 = 10)
    const updatedCustomer = await customerRepo.findById(testCustomer.id!);
    console.log(`   Puntos tras pago completo: ${updatedCustomer?.loyaltyPoints} (esperado: 10)`);
    if (updatedCustomer?.loyaltyPoints !== 10) {
      throw new Error(`Puntos debieron ser 10 pero fueron ${updatedCustomer?.loyaltyPoints}`);
    }

    // Verificar transacción en loyalty_transactions
    const loyaltyStatus = await getLoyaltyUseCase.execute(testCustomer.id!);
    console.log(`   Mensaje de fidelización en caja: "${loyaltyStatus.statusMessage}"`);
    console.log(`   Premios disponibles: ${loyaltyStatus.availableRewards} hamburguesa(s) gratis`);
    if (loyaltyStatus.availableRewards !== 1) {
      throw new Error(`Debió tener 1 premio disponible pero tiene ${loyaltyStatus.availableRewards}`);
    }
    console.log("   ✅ TEST 4 PASÓ: Pago completado acumuló +1 punto y habilitó premio.\n");

    // ── TEST 5: Redención de 10 Puntos = 1 Hamburguesa Gratis ─────────────────
    console.log("👉 TEST 5: Redimiendo 1 hamburguesa gratis (10 puntos)...");
    const redeemResult = await redeemPointsUseCase.execute({
      customerId: testCustomer.id!,
      rewardCount: 1,
      performedBy: 1,
      orderId: loyaltyOrder.id!,
      notes: "Canje de prueba",
    });

    console.log(`   Resultado canje: Descontados: ${redeemResult.pointsDeducted} pts, Saldo restante: ${redeemResult.remainingPoints} pts`);
    if (redeemResult.remainingPoints !== 0) {
      throw new Error(`Saldo debió ser 0 pero fue ${redeemResult.remainingPoints}`);
    }

    const postRedeemStatus = await getLoyaltyUseCase.execute(testCustomer.id!);
    console.log(`   Mensaje post-canje: "${postRedeemStatus.statusMessage}"`);
    console.log("   ✅ TEST 5 PASÓ: Canje auditable ejecutado correctamente.\n");

    console.log("🎉 ¡TODAS LAS PRUEBAS DEL PRIMER BLOQUE PASARON EXITOSAMENTE!");
    await disconnectDB();
  } catch (err) {
    console.error("❌ Error en las pruebas:", err);
    try { await disconnectDB(); } catch { /* ignore */ }
    Deno.exit(1);
  }
}

if (import.meta.main) {
  runTests();
}

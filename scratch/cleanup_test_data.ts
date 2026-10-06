import { Client } from "mysql";
import { config } from "../src/config/env.ts";

async function main() {
  const client = new Client();
  await client.connect({
    hostname: config.db.hostname,
    username: config.db.username,
    password: config.db.password,
    db: config.db.database,
    port: config.db.port,
  });

  console.log("=== INICIANDO LIMPIEZA DE PEDIDOS DE PRUEBA EN ARDIENTES POS ===");

  // 1. Conteos previos
  const preOrders = await client.query("SELECT COUNT(*) AS count FROM orders");
  const preItems = await client.query("SELECT COUNT(*) AS count FROM order_items");
  const preToppings = await client.query("SELECT COUNT(*) AS count FROM order_item_toppings");
  const preBeverages = await client.query("SELECT COUNT(*) AS count FROM order_beverages");
  const preCombos = await client.query("SELECT COUNT(*) AS count FROM order_combos");
  const preStatus = await client.query("SELECT COUNT(*) AS count FROM order_status_history");
  const prePayments = await client.query("SELECT COUNT(*) AS count FROM order_payments");
  const preCashTx = await client.query("SELECT COUNT(*) AS count FROM cash_transactions WHERE order_payment_id IS NOT NULL");
  const preLoyalty = await client.query("SELECT COUNT(*) AS count FROM loyalty_transactions WHERE order_id IS NOT NULL");
  const preSeq = await client.query("SELECT COUNT(*) AS count FROM daily_order_sequences");

  console.log("Conteos iniciales:");
  console.log({
    orders: preOrders[0].count,
    order_items: preItems[0].count,
    order_item_toppings: preToppings[0].count,
    order_beverages: preBeverages[0].count,
    order_combos: preCombos[0].count,
    order_status_history: preStatus[0].count,
    order_payments: prePayments[0].count,
    cash_transactions_orders: preCashTx[0].count,
    loyalty_transactions_orders: preLoyalty[0].count,
    daily_order_sequences: preSeq[0].count,
  });

  const deletedCounts: Record<string, number> = {};

  // 2. Ejecutar transacción aislada
  await client.transaction(async (conn) => {
    console.log("-> Transacción iniciada (START TRANSACTION)...");

    // 1. cash_transactions
    const resCash = await conn.execute("DELETE FROM cash_transactions WHERE order_payment_id IS NOT NULL");
    deletedCounts.cash_transactions = resCash.affectedRows ?? 0;
    console.log(`[1/10] cash_transactions eliminadas: ${deletedCounts.cash_transactions}`);

    // 2. order_payments
    const resPayments = await conn.execute("DELETE FROM order_payments");
    deletedCounts.order_payments = resPayments.affectedRows ?? 0;
    console.log(`[2/10] order_payments eliminados: ${deletedCounts.order_payments}`);

    // 3. loyalty_transactions
    const resLoyalty = await conn.execute("DELETE FROM loyalty_transactions WHERE order_id IS NOT NULL");
    deletedCounts.loyalty_transactions = resLoyalty.affectedRows ?? 0;
    console.log(`[3/10] loyalty_transactions eliminadas: ${deletedCounts.loyalty_transactions}`);

    // 4. order_status_history
    const resHistory = await conn.execute("DELETE FROM order_status_history");
    deletedCounts.order_status_history = resHistory.affectedRows ?? 0;
    console.log(`[4/10] order_status_history eliminados: ${deletedCounts.order_status_history}`);

    // 5. order_item_toppings
    const resToppings = await conn.execute("DELETE FROM order_item_toppings");
    deletedCounts.order_item_toppings = resToppings.affectedRows ?? 0;
    console.log(`[5/10] order_item_toppings eliminados: ${deletedCounts.order_item_toppings}`);

    // 6. order_items
    const resItems = await conn.execute("DELETE FROM order_items");
    deletedCounts.order_items = resItems.affectedRows ?? 0;
    console.log(`[6/10] order_items eliminados: ${deletedCounts.order_items}`);

    // 7. order_beverages
    const resBev = await conn.execute("DELETE FROM order_beverages");
    deletedCounts.order_beverages = resBev.affectedRows ?? 0;
    console.log(`[7/10] order_beverages eliminados: ${deletedCounts.order_beverages}`);

    // 8. order_combos
    const resCombos = await conn.execute("DELETE FROM order_combos");
    deletedCounts.order_combos = resCombos.affectedRows ?? 0;
    console.log(`[8/10] order_combos eliminados: ${deletedCounts.order_combos}`);

    // 9. orders
    const resOrders = await conn.execute("DELETE FROM orders");
    deletedCounts.orders = resOrders.affectedRows ?? 0;
    console.log(`[9/10] orders eliminados: ${deletedCounts.orders}`);

    // 10. daily_order_sequences
    const resSeq = await conn.execute("DELETE FROM daily_order_sequences");
    deletedCounts.daily_order_sequences = resSeq.affectedRows ?? 0;
    console.log(`[10/10] daily_order_sequences eliminadas: ${deletedCounts.daily_order_sequences}`);

    // 11. Actualizar customers y tables
    const resCust = await conn.execute("UPDATE customers SET total_orders = 0, total_spent = 0.00");
    console.log(`[UPDATE] customers restablecidos (total_orders=0, total_spent=0.00): ${resCust.affectedRows} filas actualizadas`);

    const resTables = await conn.execute("UPDATE tables SET status = 'AVAILABLE', account_requested = 0");
    console.log(`[UPDATE] tables restablecidas (status='AVAILABLE', account_requested=0): ${resTables.affectedRows} filas actualizadas`);

    // 12. Conteos de verificación dentro de la misma sesión antes del COMMIT
    console.log("-> Verificando conteos en la sesión transaccional antes del COMMIT...");
    const verifyOrders = await conn.query("SELECT COUNT(*) AS c FROM orders");
    const verifyItems = await conn.query("SELECT COUNT(*) AS c FROM order_items");
    const verifyToppings = await conn.query("SELECT COUNT(*) AS c FROM order_item_toppings");
    const verifyBev = await conn.query("SELECT COUNT(*) AS c FROM order_beverages");
    const verifyCombos = await conn.query("SELECT COUNT(*) AS c FROM order_combos");
    const verifyHistory = await conn.query("SELECT COUNT(*) AS c FROM order_status_history");
    const verifyPayments = await conn.query("SELECT COUNT(*) AS c FROM order_payments");
    const verifyCashTx = await conn.query("SELECT COUNT(*) AS c FROM cash_transactions WHERE order_payment_id IS NOT NULL");
    const verifyLoyalty = await conn.query("SELECT COUNT(*) AS c FROM loyalty_transactions WHERE order_id IS NOT NULL");
    const verifySeq = await conn.query("SELECT COUNT(*) AS c FROM daily_order_sequences");

    const sum = Number(verifyOrders[0].c) +
                Number(verifyItems[0].c) +
                Number(verifyToppings[0].c) +
                Number(verifyBev[0].c) +
                Number(verifyCombos[0].c) +
                Number(verifyHistory[0].c) +
                Number(verifyPayments[0].c) +
                Number(verifyCashTx[0].c) +
                Number(verifyLoyalty[0].c) +
                Number(verifySeq[0].c);

    if (sum !== 0) {
      throw new Error(`Verificación transaccional falló: la suma de filas restantes es ${sum} (debería ser 0). Ejecutando ROLLBACK.`);
    }

    console.log("✅ Verificación transaccional exitosa (todas las tablas en 0 registros). Realizando COMMIT...");
  });

  console.log("=== COMMIT CONFIRMADO CON ÉXITO ===");

  // 3. Verificación final independiente post-commit
  console.log("-> Ejecutando verificación final post-commit...");
  const postOrders = await client.query("SELECT COUNT(*) AS count FROM orders");
  const postItems = await client.query("SELECT COUNT(*) AS count FROM order_items");
  const postToppings = await client.query("SELECT COUNT(*) AS count FROM order_item_toppings");
  const postBeverages = await client.query("SELECT COUNT(*) AS count FROM order_beverages");
  const postCombos = await client.query("SELECT COUNT(*) AS count FROM order_combos");
  const postStatus = await client.query("SELECT COUNT(*) AS count FROM order_status_history");
  const postPayments = await client.query("SELECT COUNT(*) AS count FROM order_payments");
  const postCashTx = await client.query("SELECT COUNT(*) AS count FROM cash_transactions WHERE order_payment_id IS NOT NULL");
  const postLoyalty = await client.query("SELECT COUNT(*) AS count FROM loyalty_transactions WHERE order_id IS NOT NULL");
  const postSeq = await client.query("SELECT COUNT(*) AS count FROM daily_order_sequences");

  // Tablas estructurales que deben conservarse
  const structUsers = await client.query("SELECT COUNT(*) AS count FROM users");
  const structProducts = await client.query("SELECT COUNT(*) AS count FROM products");
  const structCategories = await client.query("SELECT COUNT(*) AS count FROM categories");
  const structCustomers = await client.query("SELECT COUNT(*) AS count FROM customers");
  const structTables = await client.query("SELECT id, table_number, status, account_requested FROM tables");
  const structSessions = await client.query("SELECT id, register_id, status, opening_balance, opened_at FROM cash_sessions ORDER BY id DESC");
  const structClosures = await client.query("SELECT COUNT(*) AS count FROM business_day_closures");

  console.log("RESULTADO FINAL:");
  console.log(JSON.stringify({
    deletedCounts,
    finalCounts: {
      orders: postOrders[0].count,
      order_items: postItems[0].count,
      order_item_toppings: postToppings[0].count,
      order_beverages: postBeverages[0].count,
      order_combos: postCombos[0].count,
      order_status_history: postStatus[0].count,
      order_payments: postPayments[0].count,
      cash_transactions_orders: postCashTx[0].count,
      loyalty_transactions_orders: postLoyalty[0].count,
      daily_order_sequences: postSeq[0].count,
    },
    structuralVerification: {
      users: structUsers[0].count,
      products: structProducts[0].count,
      categories: structCategories[0].count,
      customers: structCustomers[0].count,
      tablesCount: structTables.length,
      tables: structTables,
      cashSessionsCount: structSessions.length,
      activeSession: structSessions.find((s: any) => s.status === 'OPEN'),
      businessDayClosures: structClosures[0].count,
    }
  }, null, 2));

  await client.close();
}

main().catch(err => {
  console.error("FATAL ERROR EN LIMPIEZA:", err);
  Deno.exit(1);
});

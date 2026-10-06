import { client, connectDB, disconnectDB } from "./src/shared/infrastructure/database.ts";

async function identifyTestData() {
  await connectDB();
  try {
    // Buscar la orden específica
    const specificOrderRows = await client.query("SELECT * FROM orders WHERE order_number = ?", ["ORD-20260904-576481"]);
    console.log("Specific Order:", specificOrderRows);

    // Buscar órdenes recientes creadas en los últimos 2 días (probablemente de prueba, dado que hoy es 2026-09-13 y el error es reciente)
    const recentOrders = await client.query("SELECT * FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
    console.log("Recent Orders (Potential Test Data):", recentOrders.map(o => ({id: o.id, order_number: o.order_number, total: o.total, created_at: o.created_at})));

    // Buscar pagos asociados a estas órdenes
    if (recentOrders.length > 0) {
      const orderIds = recentOrders.map(o => o.id);
      const placeHolders = orderIds.map(() => "?").join(",");
      const payments = await client.query(`SELECT * FROM order_payments WHERE order_id IN (${placeHolders})`, orderIds);
      console.log("Associated Payments:", payments.map(p => ({id: p.id, order_id: p.order_id, amount: p.amount})));

      const paymentIds = payments.map(p => p.id);
      if (paymentIds.length > 0) {
        const paymentPlaceHolders = paymentIds.map(() => "?").join(",");
        const cashTx = await client.query(`SELECT * FROM cash_transactions WHERE order_payment_id IN (${paymentPlaceHolders})`, paymentIds);
        console.log("Associated Cash Transactions:", cashTx.map(t => ({id: t.id, order_payment_id: t.order_payment_id, amount: t.amount})));
      }
    }
  } catch (error) {
    console.error("DB Error:", error);
  } finally {
    await disconnectDB();
  }
}

identifyTestData();

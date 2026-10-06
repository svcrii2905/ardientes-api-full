import { client, connectDB, disconnectDB } from "./src/shared/infrastructure/database.ts";

async function identifyTestData() {
  await connectDB();
  try {
    const payments = await client.query(`SELECT * FROM order_payments WHERE order_id = 1`);
    console.log("Payments for Order 1:", payments.map(p => ({id: p.id, amount: p.amount, status: p.status})));

    const pIds = payments.map(p => p.id);
    if (pIds.length > 0) {
        const cashTx = await client.query(`SELECT * FROM cash_transactions WHERE order_payment_id IN (${pIds.map(()=>"?").join(",")})`, pIds);
        console.log("Cash tx for Order 1:", cashTx.map(c => ({id: c.id, amount: c.amount})));
    }
  } catch (error) {
    console.error("DB Error:", error);
  } finally {
    await disconnectDB();
  }
}

identifyTestData();

import { client, connectDB } from "../src/shared/infrastructure/database.ts";

await connectDB();

console.log("=== MESAS (tables) ===");
const tables = await client.query("SELECT id, table_number, status, account_requested FROM tables LIMIT 10");
console.table(tables);

console.log("\n=== ULTIMAS 5 ORDENES ===");
const orders = await client.query("SELECT id, order_number, table_id, total, status, paid_at, created_at FROM orders ORDER BY id DESC LIMIT 5");
console.table(orders);

console.log("\n=== ULTIMOS 5 PAGOS ===");
const payments = await client.query("SELECT id, order_id, session_id, payment_method_id, amount, status, created_at FROM order_payments ORDER BY id DESC LIMIT 5");
console.table(payments);

await client.close();

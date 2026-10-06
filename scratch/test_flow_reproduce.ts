import { client, connectDB } from "../src/shared/infrastructure/database.ts";
import { JoseJwtService } from "../src/modules/auth/infrastructure/services/JoseJwtService.ts";

await connectDB();

const jwtService = new JoseJwtService();

// Generate admin token (User ID 1 - Cajero/Admin)
const token = await jwtService.generateToken({
  sub: "1",
  username: "admin",
  fullName: "Administrador POS",
  roles: ["ADMIN", "CAJERO"],
  permissions: ["*"],
});

console.log("=== STEP 1: PREPARE TEST ORDER ON MESA 1 ===");

// 1. Clear any active orders on table 1 for clean test
await client.execute("UPDATE tables SET status = 'OCUPADA', account_requested = 0 WHERE id = 1");
await client.execute("UPDATE orders SET status = 'CANCELADO' WHERE table_id = 1 AND paid_at IS NULL AND status != 'CANCELADO'");

// 2. Create order on table 1 via API
const createOrderRes = await fetch("http://localhost:8000/api/v1/orders", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify({
    orderType: "MESA",
    tableId: 1,
    sendToKitchen: true,
    items: [
      { productId: 1, menuType: "UNIVERSITARIO", quantity: 1, unitPrice: 15000, toppings: [] }
    ]
  })
});

const createOrderData = await createOrderRes.json();
console.log("Create Order Response:", createOrderData);
const order = createOrderData.data;

if (!order || !order.id) {
  console.error("Failed to create test order!");
  await client.close();
  Deno.exit(1);
}

console.log(`Created test order #${order.id} (${order.orderNumber}) for Mesa 1 with total ${order.total}`);

// 3. Request Bill (SOLICITAR CUENTA)
const reqBillRes = await fetch(`http://localhost:8000/api/v1/tables/1/request-bill`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`
  }
});
console.log("Request Bill Response:", await reqBillRes.json());

// Check DB after SOLICITAR CUENTA
const [tableStateBefore] = await client.query("SELECT id, table_number, status, account_requested FROM tables WHERE id = 1");
const [orderStateBefore] = await client.query("SELECT id, order_number, table_id, total, status, paid_at FROM orders WHERE id = ?", [order.id]);

console.log("\n--- DB STATE BEFORE PAYMENT ---");
console.log("Table:", tableStateBefore);
console.log("Order:", orderStateBefore);

// 4. Get active Cash Session
const cashSessionRows = await client.query("SELECT id, status FROM cash_sessions WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1");
if (!cashSessionRows || cashSessionRows.length === 0) {
  console.error("No OPEN cash session found!");
  await client.close();
  Deno.exit(1);
}
const sessionId = cashSessionRows[0].id;
console.log(`Using Cash Session #${sessionId}`);

// 5. Process Payment (COBRAR)
console.log("\n=== STEP 2: PROCESS PAYMENT (COBRAR) ===");
const payRes = await fetch("http://localhost:8000/api/v1/payments", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify({
    orderId: order.id,
    paymentMethodId: 1, // EFECTIVO
    sessionId: sessionId,
    amount: parseFloat(order.total),
    changeAmount: 0,
    performedBy: 1
  })
});

const payData = await payRes.json();
console.log("Payment API Response:", payData);

// 6. Inspect DB AFTER Payment
console.log("\n=== STEP 3: DB & API INSPECTION AFTER PAYMENT ===");
const paymentsAfter = await client.query("SELECT * FROM order_payments WHERE order_id = ?", [order.id]);
const [orderStateAfter] = await client.query("SELECT id, order_number, table_id, total, status, paid_at FROM orders WHERE id = ?", [order.id]);
const [tableStateAfter] = await client.query("SELECT id, table_number, status, account_requested FROM tables WHERE id = 1");

// API Pending Cuentas check
const pendingAccountsRes = await fetch("http://localhost:8000/api/v1/tables/pending-accounts", {
  headers: { "Authorization": `Bearer ${token}` }
});
const pendingAccountsData = await pendingAccountsRes.json();

// Table 1 active orders check
const table1OrdersRes = await fetch(`http://localhost:8000/api/v1/tables/1/orders?activeOnly=true`, {
  headers: { "Authorization": `Bearer ${token}` }
});
const table1OrdersData = await table1OrdersRes.json();

console.log("\n--- AUDIT VERIFICATION RESULTS ---");
console.log("1. ¿Existe payment real?:", paymentsAfter.length > 0 ? "SI" : "NO");
console.log("2. ¿Qué amount tiene?:", paymentsAfter[0]?.amount);
console.log("3. ¿Qué order_id tiene?:", paymentsAfter[0]?.order_id);
console.log("4. ¿Quién aparece como cobrador?:", paymentsAfter[0]?.created_by || paymentsAfter[0]?.user_id || paymentsAfter[0]?.performed_by);
console.log("5. ¿La orden tiene paid_at?:", orderStateAfter?.paid_at);
console.log("6. ¿La orden aparece como PAGADA o pendiente? (orders.status):", orderStateAfter?.status);
console.log("7. ¿La mesa sigue teniendo accountRequested=true?:", tableStateAfter?.account_requested);
console.log("8. ¿La orden sigue activa para cobro (activeOnly=true)?:", table1OrdersData.data?.length > 0 ? "SI (Inesperado)" : "NO");
console.log("9. ¿El endpoint pending-accounts sigue devolviendo esa orden/mesa?:", 
  JSON.stringify(pendingAccountsData.data || []).includes(String(order.id)) ? "SI (Inesperado)" : "NO");

console.log("\nPayment Row Full:", paymentsAfter[0]);

// 7. Test Double Payment Attempt on backend
console.log("\n=== STEP 4: ATTEMPT SECOND PAYMENT (DOUBLE CHARGE TEST) ===");
const pay2Res = await fetch("http://localhost:8000/api/v1/payments", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify({
    orderId: order.id,
    paymentMethodId: 1,
    sessionId: sessionId,
    amount: parseFloat(order.total),
    changeAmount: 0,
    performedBy: 1
  })
});
const pay2Data = await pay2Res.json();
console.log("Second Payment Attempt HTTP Status:", pay2Res.status);
console.log("Second Payment Attempt API Response:", pay2Data);

await client.close();

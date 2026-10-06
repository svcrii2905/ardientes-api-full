import { client, connectDB } from "../src/shared/infrastructure/database.ts";
import { JoseJwtService } from "../src/modules/auth/infrastructure/services/JoseJwtService.ts";

await connectDB();

const jwtService = new JoseJwtService();

const token = await jwtService.generateToken({
  sub: "1",
  username: "admin",
  fullName: "Administrador POS",
  roles: ["ADMIN", "CAJERO"],
  permissions: ["*"],
});

console.log("==========================================");
console.log("VERIFICACION DE SALUD Y DESPLIEGUE");
console.log("==========================================");

// 1. Health check
const healthRes = await fetch("http://localhost:8000/health");
const healthStatus = healthRes.status;
const healthData = await healthRes.json();
console.log(`1. GET /health Status: ${healthStatus}`, healthData);

// 2. Prepare test order on Mesa 1
console.log("\n==========================================");
console.log("PRUEBA A: COBRO UNICO Y DOBLE COBRO");
console.log("==========================================");

await client.execute("UPDATE tables SET status = 'OCUPADA', account_requested = 0 WHERE id = 1");
await client.execute("UPDATE orders SET status = 'CANCELADO' WHERE table_id = 1 AND paid_at IS NULL AND status != 'CANCELADO'");

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
const order = createOrderData.data;

console.log(`Orden de prueba creada: #${order.id} (${order.orderNumber}), Status operativo: ${order.status}`);

// Request Bill
const reqBillRes = await fetch(`http://localhost:8000/api/v1/tables/1/request-bill`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${token}` }
});
console.log("Solicitar cuenta respuesta:", await reqBillRes.json());

// Get active Cash Session
const cashSessionRows = await client.query("SELECT id FROM cash_sessions WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1");
const sessionId = cashSessionRows[0].id;

// Process 1st Payment
const pay1Res = await fetch("http://localhost:8000/api/v1/payments", {
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
const pay1Data = await pay1Res.json();
console.log("Pago 1 Status HTTP:", pay1Res.status);
console.log("Pago 1 Respuesta API:", pay1Data);

// Check DB after 1st payment
const [orderAfterPay1] = await client.query("SELECT id, order_number, status, paid_at FROM orders WHERE id = ?", [order.id]);
const paymentsAfterPay1 = await client.query("SELECT * FROM order_payments WHERE order_id = ?", [order.id]);
const [tableAfterPay1] = await client.query("SELECT id, table_number, status, account_requested FROM tables WHERE id = 1");

console.log("\n--- ESTADO DB TRAS PAGO 1 ---");
console.log("paid_at establecido:", orderAfterPay1.paid_at);
console.log("order_payments count:", paymentsAfterPay1.length);
console.log("table account_requested:", tableAfterPay1.account_requested);

// Attempt 2nd Payment (Double Charge Attempt)
console.log("\n--- INTENTO DE SEGUNDO PAGO (DOBLE COBRO) ---");
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
console.log("Pago 2 Status HTTP (Esperado 400):", pay2Res.status);
console.log("Pago 2 Mensaje API:", pay2Data.error?.message);

const paymentsAfterPay2 = await client.query("SELECT * FROM order_payments WHERE order_id = ?", [order.id]);
console.log("order_payments count tras 2do intento (Esperado 1):", paymentsAfterPay2.length);

// 3. Kitchen/KDS check
console.log("\n==========================================");
console.log("PRUEBA C: NO REGRESION KDS Y OPERATIVO");
console.log("==========================================");
const kdsRes = await fetch("http://localhost:8000/api/v1/orders/kitchen?activeOnly=false", {
  headers: { "Authorization": `Bearer ${token}` }
});
const kdsData = await kdsRes.json();
console.log("GET /api/v1/orders/kitchen HTTP Status:", kdsRes.status);
console.log("Total ordenes en KDS:", kdsData.data?.length);

await client.close();

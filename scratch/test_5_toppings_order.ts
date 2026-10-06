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

console.log("=== PRUEBA DE CREACION DE PEDIDO CON 5 TOPPINGS ===");

// 1. Obtener 5 toppings activos para producto 1 (Desnudita - $7.000 en Universitario)
const productToppingRows = await client.query("SELECT topping_id FROM product_allowed_toppings WHERE product_id = 1 LIMIT 5");
const toppingIds = productToppingRows.map((r: any) => r.topping_id);

console.log(`Usando producto ID 1 ($7.000) con ${toppingIds.length} toppings:`, toppingIds);

// 2. Crear pedido vía API pasando ÚNICAMENTE los IDs de toppings (sin enviarle precio ni recargo al backend)
const createOrderRes = await fetch("http://localhost:8000/api/v1/orders", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify({
    orderType: "RECOGER",
    sendToKitchen: true,
    items: [
      {
        productId: 1,
        menuType: "UNIVERSITARIO",
        quantity: 1,
        // El cliente envía únicamente la selección de 5 toppings
        toppings: toppingIds.map((id: number) => ({ toppingId: id, quantity: 1 }))
      }
    ]
  })
});

const createOrderData = await createOrderRes.json();
console.log("Respuesta HTTP Status:", createOrderRes.status);
console.log("Respuesta API:", createOrderData);

const orderId = createOrderData.data?.id;

if (!orderId) {
  console.error("No se pudo crear el pedido!");
  await client.close();
  Deno.exit(1);
}

// 3. Inspeccionar directamente la BD
console.log("\n=== INSPECCION DIRECTA EN BASE DE DATOS ===");

const [orderRow] = await client.query("SELECT id, order_number, subtotal, disposable_fee, total FROM orders WHERE id = ?", [orderId]);
const [itemRow] = await client.query("SELECT id, product_id, unit_price, toppings_extra_price, line_total FROM order_items WHERE order_id = ?", [orderId]);
const toppingRows = await client.query("SELECT id, topping_id, topping_name, extra_price FROM order_item_toppings WHERE order_item_id = ?", [itemRow.id]);

console.log("Orden en BD:", orderRow);
console.log("Ítem en BD:", itemRow);
console.log(`Toppings guardados en BD (${toppingRows.length}):`, toppingRows);

console.log("\n--- VERIFICACION DE PRECIOS ---");
console.log("Base producto:", itemRow.unit_price, "(Esperado 7000.00)");
console.log("Recargo toppings:", itemRow.toppings_extra_price, "(Esperado 1000.00)");
console.log("Total línea ítem:", itemRow.line_total, "(Esperado 8000.00)");
console.log("Subtotal orden:", orderRow.subtotal, "(Esperado 8000.00)");
console.log("Desechables (Para llevar):", orderRow.disposable_fee, "(Esperado 1000.00)");
console.log("Total orden:", orderRow.total, "(Esperado 9000.00)");

await client.close();

import { client, connectDB } from "../src/shared/infrastructure/database.ts";

await connectDB();

const [orderRow] = await client.query("SELECT id, order_number, subtotal, disposable_fee, total FROM orders WHERE id = 85");
const [itemRow] = await client.query("SELECT id, product_id, unit_price, toppings_extra_price, line_total FROM order_items WHERE order_id = 85");
const toppingRows = await client.query("SELECT id, topping_id, topping_name, extra_price FROM order_item_toppings WHERE order_item_id = ?", [itemRow.id]);

console.log("=== VERIFICACION EN BASE DE DATOS PARA ORDEN 85 ===");
console.log("Orden:", orderRow);
console.log("Ítem:", itemRow);
console.log(`Toppings (${toppingRows.length}):`, toppingRows);

await client.close();

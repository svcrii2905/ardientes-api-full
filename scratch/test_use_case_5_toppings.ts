import { client, connectDB } from "../src/shared/infrastructure/database.ts";
import { createOrderUseCase } from "../src/modules/orders/infrastructure/dependencies.ts";
import { CreateOrderDTO } from "../src/modules/orders/application/use-cases/CreateOrderUseCase.ts";

await connectDB();

console.log("=== PRUEBA DIRECTA DE CreateOrderUseCase CON 5 TOPPINGS ===");

// Product 1 (Desnudita - $7.000 en Universitario)
const productToppingRows = await client.query("SELECT topping_id FROM product_allowed_toppings WHERE product_id = 1 LIMIT 5");
const toppingIds = productToppingRows.map((r: any) => r.topping_id);

const dto: CreateOrderDTO = {
  orderType: "RECOGER",
  userId: 1,
  sendToKitchen: true,
  items: [
    {
      productId: 1,
      menuType: "UNIVERSITARIO",
      quantity: 1,
      toppings: toppingIds.map((id: number) => ({ toppingId: id, quantity: 1 }))
    }
  ]
};

const order = await createOrderUseCase.execute(dto);

console.log(`Orden creada exitosamente por UseCase: ID ${order.id} (${order.orderNumber})`);
console.log("Status operativo:", order.status);
console.log("Subtotal:", order.subtotal);
console.log("Desechables:", order.disposableFee);
console.log("Total:", order.total);

const item = order.items[0];
console.log("\nÍtem de la orden:");
console.log("- unitPrice (Base):", item.unitPrice, "(Esperado 7000)");
console.log("- toppingsExtraPrice (Recargo adic.):", item.toppingsExtraPrice, "(Esperado 1000)");
console.log("- lineTotal (Total línea):", item.lineTotal, "(Esperado 8000)");
console.log("- Toppings guardados:", item.toppings.length);

await client.close();

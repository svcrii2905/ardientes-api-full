import { connectDB, client, disconnectDB } from "./shared/infrastructure/database.ts";

const toppingsList = [
  { name: "Cebolla caramelizada", price: 0.00, cat: "VEGETAL" },
  { name: "Pico de gallo", price: 0.00, cat: "VEGETAL" },
  { name: "Guacamole", price: 0.00, cat: "VEGETAL" },
  { name: "Jalapeños", price: 0.00, cat: "VEGETAL" },
  { name: "Papitas chips", price: 0.00, cat: "OTRO" },
  { name: "Nachos", price: 0.00, cat: "OTRO" },
  { name: "Maíz tierno", price: 0.00, cat: "VEGETAL" },
  { name: "Maduros", price: 0.00, cat: "VEGETAL" },
  { name: "Tomate", price: 0.00, cat: "VEGETAL" },
  { name: "Piña", price: 0.00, cat: "VEGETAL" },
  { name: "Lluvia de queso gratinado", price: 0.00, cat: "QUESO" },
  { name: "Combo Universitario (Papas + Gaseosa)", price: 5000.00, cat: "OTRO" }
];

async function main() {
  try {
    await connectDB();
    await client.execute("SET FOREIGN_KEY_CHECKS = 0");

    // Limpiar toppings antiguos
    await client.execute("TRUNCATE TABLE `product_allowed_toppings`");
    await client.execute("TRUNCATE TABLE `toppings`");

    console.log("Inserting toppings...");
    const mapping: Record<string, number> = {};
    for (let i = 0; i < toppingsList.length; i++) {
      const t = toppingsList[i];
      await client.execute(
        "INSERT INTO toppings (id, name, extra_price, category, is_active) VALUES (?, ?, ?, ?, 1)",
        [i + 1, t.name, t.price, t.cat]
      );
      mapping[t.name] = i + 1;
    }

    console.log("Associating toppings to products...");
    // Obtener productos
    const products = await client.query("SELECT id FROM products");
    
    for (const p of products) {
      const pId = Number(p.id);
      for (const tName of Object.keys(mapping)) {
        await client.execute(
          "INSERT INTO product_allowed_toppings (product_id, topping_id) VALUES (?, ?)",
          [pId, mapping[tName]]
        );
      }
    }

    await client.execute("SET FOREIGN_KEY_CHECKS = 1");
    console.log("Toppings seed completed successfully!");
    await disconnectDB();
  } catch (err) {
    console.error("Error seeding toppings:", err);
    try {
      await disconnectDB();
    } catch { /* ignore */ }
  }
}

if (import.meta.main) {
  main();
}

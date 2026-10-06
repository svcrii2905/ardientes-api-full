import { connectDB, client, disconnectDB } from "./shared/infrastructure/database.ts";

async function runMigration() {
  try {
    await connectDB();
    console.log("🚀 Aplicando migración para Primer Bloque de Ardientes POS...");

    // 1. Agregar columna disposable_fee a orders si no existe
    const columns = await client.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'ardientes_pos' AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'disposable_fee'"
    );

    if (columns.length === 0) {
      console.log("➕ Agregando columna disposable_fee a tabla orders...");
      await client.execute(
        "ALTER TABLE `orders` ADD COLUMN `disposable_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `tax_amount`"
      );
    } else {
      console.log("✔ Columna disposable_fee ya existe en orders.");
    }

    // 2. Agregar UNIQUE KEY uq_loyalty_order_reason a loyalty_transactions si no existe
    const indices = await client.query(
      "SHOW INDEX FROM `loyalty_transactions` WHERE Key_name = 'uq_loyalty_order_reason'"
    );

    if (indices.length === 0) {
      console.log("➕ Agregando UNIQUE KEY uq_loyalty_order_reason a loyalty_transactions...");
      try {
        await client.execute(
          "ALTER TABLE `loyalty_transactions` ADD UNIQUE KEY `uq_loyalty_order_reason` (`order_id`, `reason`)"
        );
      } catch (e) {
        console.warn("Aviso al crear índice uq_loyalty_order_reason:", e);
      }
    } else {
      console.log("✔ Índice uq_loyalty_order_reason ya existe.");
    }

    // 3. Actualizar hamburguesas universitarias (IDs 1-7)
    console.log("🔄 Actualizando hamburguesas universitarias (IDs 1-7)...");
    await client.execute(`
      UPDATE products 
      SET available_in = 'UNIVERSITARIO', price_especial = NULL 
      WHERE id IN (1, 2, 3, 4, 5, 6, 7)
    `);

    // 4. Insertar las 6 hamburguesas especiales (IDs 59-64)
    console.log("🍔 Insertando hamburguesas del Menú Especial (IDs 59-64)...");
    const specialBurgers = [
      {
        id: 59,
        sku: 'HAMB-ESP-DESN-001',
        name: 'Desnudita',
        desc: 'Carne de res, queso cheddar, toppings ilimitados. Incluye porción de papa.',
        price: 15000.00
      },
      {
        id: 60,
        sku: 'HAMB-ESP-DOBL-002',
        name: 'Doble Placer',
        desc: 'Carne de res x2, tocineta, queso cheddar, toppings ilimitados. Incluye porción de papa.',
        price: 17000.00
      },
      {
        id: 61,
        sku: 'HAMB-ESP-TENT-003',
        name: 'Tentadora',
        desc: 'Carne de res, queso cheddar, tocineta y toppings ilimitados. Incluye porción de papa.',
        price: 17000.00
      },
      {
        id: 62,
        sku: 'HAMB-ESP-AFRO-004',
        name: 'Afrodisiaca',
        desc: 'Carne de res, carne desmechada, mermelada de tocineta y costilla, queso cheddar y toppings ilimitados. Incluye porción de papa.',
        price: 20000.00
      },
      {
        id: 63,
        sku: 'HAMB-ESP-ARDI-005',
        name: 'Ardiente',
        desc: 'Carne de res, carne desmechada, tocineta caramelizada, chorizo bañado en chimichurri, queso cheddar y toppings ilimitados. Incluye porción de papa.',
        price: 22000.00
      },
      {
        id: 64,
        sku: 'HAMB-ESP-AESP-006',
        name: 'Ardiente Especial',
        desc: 'Carne de res, carne desmechada, tocineta caramelizada, chorizo bañado en chimichurri, queso cheddar y toppings ilimitados, además de queso fundido cremoso combinado con suave maíz tierno. Incluye porción de papa.',
        price: 25000.00
      }
    ];

    for (const b of specialBurgers) {
      await client.execute(`
        INSERT INTO products (id, category_id, sku, name, description, price_universitario, price_especial, image_url, has_toppings, production_station, available_in, is_active)
        VALUES (?, 1, ?, ?, ?, NULL, ?, ?, 1, 'PARRILLA', 'ESPECIAL', 1)
        ON DUPLICATE KEY UPDATE
          category_id = 1,
          name = VALUES(name),
          description = VALUES(description),
          price_universitario = NULL,
          price_especial = VALUES(price_especial),
          has_toppings = 1,
          available_in = 'ESPECIAL',
          is_active = 1
      `, [b.id, b.sku, b.name, b.desc, b.price, `${b.sku.toLowerCase()}.jpg`]);
    }

    // 5. Vincular toppings a estas nuevas hamburguesas
    console.log("🥗 Asociando toppings a hamburguesas especiales...");
    const activeToppings = await client.query("SELECT id FROM toppings WHERE is_active = 1");
    for (const b of specialBurgers) {
      for (const t of activeToppings) {
        await client.execute(`
          INSERT IGNORE INTO product_allowed_toppings (product_id, topping_id)
          VALUES (?, ?)
        `, [b.id, t.id]);
      }
    }

    console.log("✅ Migración del Primer Bloque completada con éxito.");
    await disconnectDB();
  } catch (err) {
    console.error("❌ Error en la migración:", err);
    try { await disconnectDB(); } catch { /* ignore */ }
    Deno.exit(1);
  }
}

if (import.meta.main) {
  runMigration();
}

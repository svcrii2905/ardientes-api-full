import { client, connectDB, disconnectDB } from "./shared/infrastructure/database.ts";

async function migrate() {
  console.log("🚀 Iniciando migración Bloque 2: KDS / Cocina...");
  await connectDB();

  try {
    // 1. Verificar si la columna kitchen_started_at ya existe en orders
    const columns = await client.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'orders'
        AND COLUMN_NAME = 'kitchen_started_at'
    `);

    if (columns.length === 0) {
      console.log("➕ Agregando columna 'kitchen_started_at' a la tabla 'orders'...");
      await client.execute(`
        ALTER TABLE orders
        ADD COLUMN kitchen_started_at DATETIME NULL DEFAULT NULL
        AFTER paid_at
      `);
      console.log("✅ Columna 'kitchen_started_at' agregada exitosamente.");
    } else {
      console.log("ℹ️ La columna 'kitchen_started_at' ya existe en 'orders'.");
    }

    // 2. Verificar si el índice idx_orders_kitchen ya existe
    const indexes = await client.query(`
      SELECT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'orders'
        AND INDEX_NAME = 'idx_orders_kitchen'
    `);

    if (indexes.length === 0) {
      console.log("➕ Creando índice 'idx_orders_kitchen'...");
      await client.execute(`
        ALTER TABLE orders
        ADD INDEX idx_orders_kitchen (status, kitchen_started_at)
      `);
      console.log("✅ Índice 'idx_orders_kitchen' creado.");
    } else {
      console.log("ℹ️ El índice 'idx_orders_kitchen' ya existe.");
    }

    // 3. Inicializar kitchen_started_at para órdenes existentes en curso
    const updateResult = await client.execute(`
      UPDATE orders
      SET kitchen_started_at = COALESCE(paid_at, created_at)
      WHERE kitchen_started_at IS NULL
        AND status IN ('CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO')
    `);
    console.log(`ℹ️ Órdenes existentes actualizadas con timestamp de cocina: ${updateResult.affectedRows}`);

    console.log("🎉 Migración Bloque 2 completada exitosamente.");
    await disconnectDB();
  } catch (err) {
    console.error("❌ Error en la migración Bloque 2:", err);
    try { await disconnectDB(); } catch { /* ignore */ }
    Deno.exit(1);
  }
}

if (import.meta.main) {
  migrate();
}

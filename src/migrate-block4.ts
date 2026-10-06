import { connectDB, client, disconnectDB } from "./shared/infrastructure/database.ts";

export async function migrateBlock4(): Promise<void> {
  console.log("🚀 Ejecutando migración y seed 100% aditiva para Bloque 4 (Mesas + Mesero)...");

  // 1. Asegurar columnas en tabla `tables`
  const columns = await client.query("DESCRIBE `tables`");
  const columnNames = new Set(columns.map((c: any) => c.Field));

  // Modificar status a ENUM('LIBRE','OCUPADA','AVAILABLE','OCCUPIED','RESERVED') de manera retrocompatible
  console.log("   Actualizando definición de columna `status` en `tables`...");
  await client.query(
    "ALTER TABLE `tables` MODIFY `status` ENUM('LIBRE', 'OCUPADA', 'AVAILABLE', 'OCCUPIED', 'RESERVED') NOT NULL DEFAULT 'LIBRE'"
  );
  await client.query("UPDATE `tables` SET `status` = 'LIBRE' WHERE `status` IN ('AVAILABLE', 'RESERVED')");
  await client.query("UPDATE `tables` SET `status` = 'OCUPADA' WHERE `status` = 'OCCUPIED'");

  // Ampliar table_number VARCHAR(50)
  await client.query("ALTER TABLE `tables` MODIFY `table_number` VARCHAR(50) NOT NULL");

  // Agregar account_requested si no existe
  if (!columnNames.has("account_requested")) {
    console.log("   Agregando columna `account_requested` a tabla `tables`...");
    await client.query("ALTER TABLE `tables` ADD COLUMN `account_requested` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`");
  }

  // Agregar created_at si no existe
  if (!columnNames.has("created_at")) {
    console.log("   Agregando columna `created_at` a tabla `tables`...");
    await client.query("ALTER TABLE `tables` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  }

  // Agregar updated_at si no existe
  if (!columnNames.has("updated_at")) {
    console.log("   Agregando columna `updated_at` a tabla `tables`...");
    await client.query("ALTER TABLE `tables` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  // 2. Asegurar Zona Salón Principal (id = 1)
  await client.query(
    "INSERT INTO `zones` (`id`, `name`) VALUES (1, 'Salón Principal') ON DUPLICATE KEY UPDATE `name` = VALUES(`name`)"
  );

  // 3. Seed aditivo de las 7 mesas físicas exactas (MESA 1 a MESA 7)
  // Identificadas por table_number, respetando IDs autoincrementales sin borrados
  console.log("   Garantizando existencia de las 7 mesas físicas...");
  const desiredTables = [
    { number: 1, name: "MESA 1", capacity: 4 },
    { number: 2, name: "MESA 2", capacity: 4 },
    { number: 3, name: "MESA 3", capacity: 4 },
    { number: 4, name: "MESA 4", capacity: 4 },
    { number: 5, name: "MESA 5", capacity: 6 },
    { number: 6, name: "MESA 6", capacity: 6 },
    { number: 7, name: "MESA 7", capacity: 8 },
  ];

  for (const t of desiredTables) {
    const existing = await client.query(
      "SELECT id FROM `tables` WHERE `table_number` = ? LIMIT 1",
      [t.name]
    );

    if (existing.length === 0) {
      // Si no existe con el nombre exacto, verificar si podemos renombrar registros iniciales M-01 a M-03 si aplican
      const aliasMap: Record<number, string> = { 1: "M-01", 2: "M-02", 3: "M-03", 4: "T-01", 5: "T-02" };
      const oldAlias = aliasMap[t.number];
      let renamed = false;
      if (oldAlias) {
        const oldRow = await client.query("SELECT id FROM `tables` WHERE `table_number` = ? LIMIT 1", [oldAlias]);
        if (oldRow.length > 0) {
          await client.query("UPDATE `tables` SET `table_number` = ? WHERE `id` = ?", [t.name, oldRow[0].id]);
          renamed = true;
          console.log(`   Mesa antigua ${oldAlias} (ID: ${oldRow[0].id}) actualizada a '${t.name}'`);
        }
      }

      if (!renamed) {
        // Inserción puramente aditiva con ID autoincremental
        const result = await client.query(
          "INSERT INTO `tables` (`zone_id`, `table_number`, `capacity`, `status`, `account_requested`) VALUES (1, ?, ?, 'LIBRE', 0)",
          [t.name, t.capacity]
        );
        console.log(`   Mesa '${t.name}' creada con ID autoincremental ${result.lastInsertId}`);
      }
    }
  }

  // NUNCA eliminar mesas existentes (100% aditiva)

  // 4. Asegurar Rol MESERO y permisos
  console.log("   Sincronizando rol MESERO y permisos...");
  await client.query(
    `INSERT INTO \`roles\` (\`id\`, \`name\`, \`description\`)
     VALUES (6, 'MESERO', 'Personal de salón: toma pedidos en mesas, cambia mesas y solicita cuentas')
     ON DUPLICATE KEY UPDATE \`description\` = VALUES(\`description\`)`
  );

  const permissionsToSeed = [
    { id: 13, code: "tables:read", description: "Consultar estado de mesas" },
    { id: 14, code: "tables:orders", description: "Crear y consultar pedidos de mesas" },
    { id: 15, code: "tables:request_bill", description: "Solicitar cuenta de mesas" },
    { id: 16, code: "tables:transfer", description: "Cambiar pedidos entre mesas" },
  ];

  for (const p of permissionsToSeed) {
    await client.query(
      `INSERT INTO \`permissions\` (\`id\`, \`code\`, \`description\`)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE \`description\` = VALUES(\`description\`)`,
      [p.id, p.code, p.description]
    );
    // Asignar al rol MESERO (id = 6) y ADMIN (id = 1)
    await client.query(
      `INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`) VALUES (6, ?), (1, ?)`,
      [p.id, p.id]
    );
  }

  // Asignar orders:create (id = 1) a MESERO
  await client.query(
    `INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`) VALUES (6, 1)`
  );

  console.log("✅ Migración y seed de Bloque 4 completada exitosamente.\n");
}

if (import.meta.main) {
  try {
    await connectDB();
    await migrateBlock4();
  } catch (error) {
    console.error("❌ Error en migración de Bloque 4:", error);
    Deno.exit(1);
  } finally {
    await disconnectDB();
  }
}

import { Client } from "mysql";
import { config } from "../config/env.ts";

export async function migrateCustomerAuth(): Promise<void> {
  console.log("🚀 Iniciando migración aditiva para soporte de autenticación de clientes...");

  // Conectar con credenciales administrativas para ejecutar DDL
  const adminClient = await new Client().connect({
    hostname: config.db.hostname,
    username: Deno.env.get("DB_ADMIN_USERNAME") || "root",
    password: Deno.env.get("DB_ADMIN_PASSWORD") || "",
    db: config.db.database,
    port: config.db.port,
  });

  // Verificar columnas existentes en la tabla `customers`
  const rows = await adminClient.query(`
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers'
  `);
  const existingColumns = new Set(rows.map((r: any) => String(r.COLUMN_NAME).toLowerCase()));

  // 1. password_hash VARCHAR(255) NULL
  if (!existingColumns.has("password_hash")) {
    console.log("   Agregando columna `password_hash`...");
    await adminClient.execute("ALTER TABLE `customers` ADD COLUMN `password_hash` VARCHAR(255) NULL AFTER `address`");
  } else {
    console.log("   Columna `password_hash` ya existe.");
  }

  // 2. token_version INT NOT NULL DEFAULT 1
  if (!existingColumns.has("token_version")) {
    console.log("   Agregando columna `token_version`...");
    await adminClient.execute("ALTER TABLE `customers` ADD COLUMN `token_version` INT NOT NULL DEFAULT 1 AFTER `password_hash`");
  } else {
    console.log("   Columna `token_version` ya existe.");
  }

  // 3. email_verified TINYINT(1) NOT NULL DEFAULT 0
  if (!existingColumns.has("email_verified")) {
    console.log("   Agregando columna `email_verified`...");
    await adminClient.execute("ALTER TABLE `customers` ADD COLUMN `email_verified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `token_version`");
  } else {
    console.log("   Columna `email_verified` ya existe.");
  }

  // 4. last_login_at DATETIME NULL
  if (!existingColumns.has("last_login_at")) {
    console.log("   Agregando columna `last_login_at`...");
    await adminClient.execute("ALTER TABLE `customers` ADD COLUMN `last_login_at` DATETIME NULL AFTER `email_verified`");
  } else {
    console.log("   Columna `last_login_at` ya existe.");
  }

  await adminClient.close();
  console.log("✅ Migración de clientes completada exitosamente.");
}

if (import.meta.main) {
  try {
    await migrateCustomerAuth();
    Deno.exit(0);
  } catch (error) {
    console.error("❌ Error en la migración de clientes:", error);
    Deno.exit(1);
  }
}

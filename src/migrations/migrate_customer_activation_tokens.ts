import { Client } from "mysql";
import { config } from "../config/env.ts";

export async function migrateCustomerActivationTokens(): Promise<void> {
  console.log("🚀 Iniciando migración aditiva para customer_activation_tokens...");

  const adminClient = await new Client().connect({
    hostname: config.db.hostname,
    username: Deno.env.get("DB_ADMIN_USERNAME") || "root",
    password: Deno.env.get("DB_ADMIN_PASSWORD") || "",
    db: config.db.database,
    port: config.db.port,
  });

  try {
    // 1. Crear tabla customer_activation_tokens
    await adminClient.execute(`
      CREATE TABLE IF NOT EXISTS customer_activation_tokens (
        id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        customer_id  BIGINT UNSIGNED NOT NULL,
        code_hash    VARCHAR(255) NOT NULL,
        expires_at   DATETIME NOT NULL,
        attempts     TINYINT UNSIGNED NOT NULL DEFAULT 0,
        max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 3,
        used_at      DATETIME NULL DEFAULT NULL,
        created_by   BIGINT UNSIGNED NOT NULL,
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_act_customer (customer_id, used_at, expires_at),
        CONSTRAINT fk_act_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
        CONSTRAINT fk_act_creator  FOREIGN KEY (created_by)  REFERENCES users (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("   ✅ Tabla `customer_activation_tokens` verificada / creada.");

    // 2. Conceder permisos al usuario de la aplicación ardientes_app
    await adminClient.execute(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON ardientes_pos.customer_activation_tokens TO 'ardientes_app'@'localhost'"
    );
    await adminClient.execute(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON ardientes_pos.customer_activation_tokens TO 'ardientes_app'@'127.0.0.1'"
    );
    await adminClient.execute("FLUSH PRIVILEGES");
    console.log("   ✅ Permisos otorgados a `ardientes_app`.");
  } finally {
    await adminClient.close();
  }
}

if (import.meta.main) {
  try {
    await migrateCustomerActivationTokens();
    Deno.exit(0);
  } catch (error) {
    console.error("❌ Error en migración customer_activation_tokens:", error);
    Deno.exit(1);
  }
}

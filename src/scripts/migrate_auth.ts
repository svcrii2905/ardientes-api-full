import { Client } from "mysql";

async function runMigration() {
  console.log("Iniciando migración con usuario administrativo...");
  const rootClient = new Client();
  await rootClient.connect({
    hostname: "127.0.0.1",
    username: "root",
    password: "",
    db: "ardientes_pos",
    port: 3306,
  });

  try {
    console.log("Conectado como root a ardientes_pos.");

    // 1. Agregar columna token_version a users si no existe
    const columns = await rootClient.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'ardientes_pos' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'token_version'"
    );

    if (columns.length === 0) {
      console.log("Agregando columna token_version a tabla users...");
      await rootClient.execute(
        "ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER is_active"
      );
      console.log("✅ Columna token_version agregada exitosamente.");
    } else {
      console.log("ℹ️ Columna token_version ya existe en tabla users.");
    }

    // 2. Crear tabla auth_verification_codes si no existe
    console.log("Verificando tabla auth_verification_codes...");
    await rootClient.execute(`
      CREATE TABLE IF NOT EXISTS auth_verification_codes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        type ENUM('PASSWORD_RESET', 'EMAIL_VERIFICATION') NOT NULL,
        target_email VARCHAR(120) NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
        used_at DATETIME NULL DEFAULT NULL,
        ip_address VARCHAR(45) NULL DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_auth_codes_user_type (user_id, type),
        KEY idx_auth_codes_lookup (target_email, type, expires_at, used_at),
        CONSTRAINT fk_auth_codes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Tabla auth_verification_codes lista y verificada.");

    // 3. Otorgar permisos necesarios a ardientes_app sobre la nueva tabla si hace falta
    console.log("Otorgando permisos a ardientes_app sobre auth_verification_codes...");
    await rootClient.execute(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON ardientes_pos.auth_verification_codes TO 'ardientes_app'@'localhost'"
    );
    await rootClient.execute(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON ardientes_pos.auth_verification_codes TO 'ardientes_app'@'127.0.0.1'"
    );
    await rootClient.execute("FLUSH PRIVILEGES");
    console.log("✅ Permisos concedidos.");

  } finally {
    await rootClient.close();
    console.log("Conexión root cerrada.");
  }
}

if (import.meta.main) {
  runMigration().then(() => {
    console.log("Migración completada con éxito total.");
  }).catch((err) => {
    console.error("Error en migración:", err.message);
    Deno.exit(1);
  });
}

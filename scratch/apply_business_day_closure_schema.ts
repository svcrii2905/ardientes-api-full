import { Client } from "mysql";

async function main() {
  const client = new Client();
  await client.connect({
    hostname: "127.0.0.1",
    username: "root",
    password: "",
    db: "ardientes_pos",
    port: 3306
  });

  console.log("Applying business_day_closures DDL and permissions...");

  // 1. Crear tabla business_day_closures
  await client.execute(`
    CREATE TABLE IF NOT EXISTS \`business_day_closures\` (
      \`id\`                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`business_date\`      DATE NOT NULL UNIQUE,
      \`opened_at\`          DATETIME NOT NULL,
      \`closed_at\`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`closed_by_user_id\`  BIGINT UNSIGNED NOT NULL,
      \`total_orders_count\` INT UNSIGNED NOT NULL DEFAULT 0,
      \`total_sales_amount\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      \`total_cash_amount\`  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      \`total_digital_amount\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      \`total_card_amount\`  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      \`notes\`              TEXT NULL,
      \`created_at\`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT \`fk_closures_user\` FOREIGN KEY (\`closed_by_user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. Insertar permiso business_day:close
  await client.execute(`
    INSERT INTO \`permissions\` (\`id\`, \`code\`, \`description\`)
    VALUES (17, 'business_day:close', 'Cerrar la jornada operativa del día')
    ON DUPLICATE KEY UPDATE \`code\` = VALUES(\`code\`), \`description\` = VALUES(\`description\`);
  `);

  // 3. Asignar permiso a ADMIN (role_id = 1)
  await client.execute(`
    INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`)
    VALUES (1, 17);
  `);

  console.log("DDL for business_day_closures and permissions applied successfully!");
  await client.close();
}

main().catch(console.error);

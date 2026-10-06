import { client, connectDB, disconnectDB } from "../src/shared/infrastructure/database.ts";

async function main() {
  await connectDB();

  console.log("Applying DDL schema for daily order sequences...");

  // 1. Create daily_order_sequences table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS \`daily_order_sequences\` (
      \`sequence_date\` DATE NOT NULL PRIMARY KEY,
      \`last_value\`    INT UNSIGNED NOT NULL DEFAULT 0,
      \`updated_at\`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("Created table daily_order_sequences (if not exists)");

  // 2. Add order_date and daily_order_number columns to orders table if not exist
  const columns = await client.query("SHOW COLUMNS FROM `orders` LIKE 'daily_order_number'");
  if (!columns || columns.length === 0) {
    await client.execute(`
      ALTER TABLE \`orders\`
        ADD COLUMN \`order_date\` DATE NULL AFTER \`order_number\`,
        ADD COLUMN \`daily_order_number\` INT UNSIGNED NULL AFTER \`order_date\`;
    `);
    console.log("Added columns order_date and daily_order_number to orders table");
  } else {
    console.log("Columns order_date and daily_order_number already exist in orders table");
  }

  // 3. Add UNIQUE index uq_orders_daily_number if not exists
  const indexes = await client.query("SHOW INDEX FROM `orders` WHERE Key_name = 'uq_orders_daily_number'");
  if (!indexes || indexes.length === 0) {
    await client.execute(`
      CREATE UNIQUE INDEX \`uq_orders_daily_number\` ON \`orders\` (\`order_date\`, \`daily_order_number\`);
    `);
    console.log("Created UNIQUE index uq_orders_daily_number on orders (order_date, daily_order_number)");
  } else {
    console.log("UNIQUE index uq_orders_daily_number already exists");
  }

  await disconnectDB();
  console.log("DDL schema execution finished successfully.");
}

main().catch(console.error);

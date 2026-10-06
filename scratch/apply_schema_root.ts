import { Client } from "mysql";

async function main() {
  const client = new Client();
  try {
    await client.connect({
      hostname: "127.0.0.1",
      username: "root",
      password: "",
      db: "ardientes_pos",
      port: 3306
    });
    console.log("ROOT CONNECTED WITHOUT PASSWORD!");
    
    await client.execute(`
      CREATE TABLE IF NOT EXISTS \`daily_order_sequences\` (
        \`sequence_date\` DATE NOT NULL PRIMARY KEY,
        \`last_value\`    INT UNSIGNED NOT NULL DEFAULT 0,
        \`updated_at\`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("DDL 1 SUCCESS: daily_order_sequences table created.");

    const columns = await client.query("SHOW COLUMNS FROM `orders` LIKE 'daily_order_number'");
    if (!columns || columns.length === 0) {
      await client.execute(`
        ALTER TABLE \`orders\`
          ADD COLUMN \`order_date\` DATE NULL AFTER \`order_number\`,
          ADD COLUMN \`daily_order_number\` INT UNSIGNED NULL AFTER \`order_date\`;
      `);
      console.log("DDL 2 SUCCESS: order_date & daily_order_number columns added.");
    } else {
      console.log("DDL 2 SUCCESS: columns already exist.");
    }

    const indexes = await client.query("SHOW INDEX FROM `orders` WHERE Key_name = 'uq_orders_daily_number'");
    if (!indexes || indexes.length === 0) {
      await client.execute(`
        CREATE UNIQUE INDEX \`uq_orders_daily_number\` ON \`orders\` (\`order_date\`, \`daily_order_number\`);
      `);
      console.log("DDL 3 SUCCESS: uq_orders_daily_number unique index created.");
    } else {
      console.log("DDL 3 SUCCESS: index already exists.");
    }

    await client.close();
  } catch (err) {
    console.error("ROOT CONNECT FAIL:", err);
  }
}

main();

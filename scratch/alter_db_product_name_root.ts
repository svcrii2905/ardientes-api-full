import { Client } from "mysql";

async function run() {
  const client = new Client();
  try {
    await client.connect({
      hostname: "127.0.0.1",
      username: "root",
      password: "",
      db: "ardientes_pos",
      port: 3306
    });
    console.log("ROOT CONNECTED");
    await client.execute(`ALTER TABLE order_items ADD COLUMN product_name VARCHAR(120) NULL;`);
    console.log("Migration successful");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.close();
  }
}

run();

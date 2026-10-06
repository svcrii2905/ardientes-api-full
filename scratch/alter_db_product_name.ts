import { client, connectDB, disconnectDB } from "../src/shared/infrastructure/database.ts";

async function run() {
  await connectDB();
  try {
    await client.execute(`ALTER TABLE order_items ADD COLUMN product_name VARCHAR(120) NULL;`);
    console.log("Migration successful");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await disconnectDB();
  }
}

run();

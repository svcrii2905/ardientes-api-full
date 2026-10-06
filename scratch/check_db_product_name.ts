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
    
    const cols = await client.query(`SHOW COLUMNS FROM order_items WHERE Field = 'product_name';`);
    console.log("COLUMN STRUCTURE:", cols);
    
    const rows = await client.query(`SELECT order_id, product_id, product_name, notes FROM order_items WHERE product_id = 3 LIMIT 1;`);
    console.log("ROW PRODUCT 3:", rows);

  } catch (error) {
    console.error("Query failed:", error);
  } finally {
    await client.close();
  }
}

run();

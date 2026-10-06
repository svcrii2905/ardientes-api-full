import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";
import "https://deno.land/std@0.224.0/dotenv/load.ts";

const client = await new Client().connect({
  hostname: "127.0.0.1",
  username: "root",
  db: "ardientes_pos",
  password: "", // Assuming no password for root locally as seen before
  port: 3306,
});

const res = await client.execute("SELECT id, order_number, status, delivery_company, order_type FROM orders WHERE order_type = 'DOMICILIO' ORDER BY id DESC LIMIT 5");
console.log(res.rows);
await client.close();

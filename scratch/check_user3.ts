import { client } from "../src/shared/infrastructure/database.ts";

async function main() {
  const users = await client.query(
    `SELECT id, username, full_name FROM users WHERE id = 3 LIMIT 1`
  );
  console.log("USER #3 DATA:", JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => Deno.exit(0));

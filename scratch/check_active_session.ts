import { client } from "../src/shared/infrastructure/database.ts";

async function main() {
  const sessions = await client.query(
    `SELECT cs.id, cs.opened_by_user_id, cs.status, cs.opened_at,
            u.full_name, u.username,
            COALESCE(NULLIF(TRIM(u.full_name), ''), u.username, CONCAT('Usuario #', cs.opened_by_user_id)) AS opened_by_user_name
     FROM cash_sessions cs
     LEFT JOIN users u ON u.id = cs.opened_by_user_id
     WHERE cs.status = 'OPEN' AND cs.register_id = 1
     LIMIT 1`
  );
  console.log("ACTIVE SESSION ROW:", JSON.stringify(sessions, null, 2));
}

main().catch(console.error).finally(() => Deno.exit(0));

import { client, connectDB, disconnectDB } from "../src/shared/infrastructure/database.ts";

async function main() {
  await connectDB();

  // 1. Check Engine of orders table
  const tableStatus = await client.query(
    "SHOW TABLE STATUS WHERE Name = 'orders'"
  );
  console.log("ORDERS TABLE ENGINE:", tableStatus[0]?.Engine);

  // 2. Check DB Timezone
  const timezones = await client.query(
    "SELECT @@global.time_zone AS global_tz, @@session.time_zone AS session_tz, NOW() AS db_now, CURDATE() AS db_curdate"
  );
  console.log("DB TIMEZONES & NOW:", JSON.stringify(timezones, null, 2));

  // 3. Test Colombia Date formatting in Deno
  const now = new Date();
  const colombiaDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  console.log("SYSTEM NOW (UTC):", now.toISOString());
  console.log("COLOMBIA DATE (America/Bogota):", colombiaDateStr);

  await disconnectDB();
}

main().catch(console.error);

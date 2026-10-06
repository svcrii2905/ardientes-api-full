import { BcryptPasswordService } from "./src/modules/auth/infrastructure/services/BcryptPasswordService.ts";
import { client, connectDB, disconnectDB } from "./src/shared/infrastructure/database.ts";

async function testHashes() {
  await connectDB();
  const service = new BcryptPasswordService();
  
  // Get hashes from db
  const users = await client.query("SELECT username, password_hash FROM users LIMIT 3");
  
  for (const user of users) {
    const prefix = user.password_hash.substring(0, 4);
    console.log(`Testing ${prefix} hash verification for ${user.username}...`);
    try {
      const result = await service.compare("dummy_password", user.password_hash);
      console.log(`Result ${prefix}:`, typeof result === "boolean" ? "Returned boolean correctly" : "Failed");
    } catch(e) {
      console.error(`Crash on ${prefix}`, e);
    }
  }
  
  await disconnectDB();
}

testHashes();

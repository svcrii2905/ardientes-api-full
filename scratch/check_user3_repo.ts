import { connectDB, disconnectDB } from "../src/shared/infrastructure/database.ts";
import { MySQLUserRepository } from "../src/modules/auth/infrastructure/mysql/MySQLUserRepository.ts";

async function main() {
  await connectDB();
  const repo = new MySQLUserRepository();
  const user = await repo.findById(3);
  console.log("USER #3 PROFILE:", JSON.stringify({
    id: user?.id,
    username: user?.username,
    fullName: user?.fullName
  }, null, 2));
  await disconnectDB();
}

main().catch(console.error);

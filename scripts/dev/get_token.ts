import { config } from "./src/config/env.ts";
import { connectDB, disconnectDB } from "./src/shared/infrastructure/database.ts";
import { JoseJwtService } from "./src/modules/auth/infrastructure/services/JoseJwtService.ts";
import { MySQLUserRepository } from "./src/modules/auth/infrastructure/mysql/MySQLUserRepository.ts";

async function run() {
  await connectDB();
  const jwt = new JoseJwtService();
  const repo = new MySQLUserRepository();
  
  const user = await repo.findByUsername("admin");
  const token = await jwt.generateToken({
    sub: String(user.id),
    username: user.username,
    fullName: user.fullName,
    roles: user.roles,
    permissions: user.permissions,
  });
  console.log(token);
  await disconnectDB();
}
run();

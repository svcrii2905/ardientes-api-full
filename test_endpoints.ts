import { config } from "./src/config/env.ts";
import { connectDB, disconnectDB } from "./src/shared/infrastructure/database.ts";
import { JoseJwtService } from "./src/modules/auth/infrastructure/services/JoseJwtService.ts";
import { MySQLUserRepository } from "./src/modules/auth/infrastructure/mysql/MySQLUserRepository.ts";

async function run() {
  await connectDB();
  const jwt = new JoseJwtService();
  const repo = new MySQLUserRepository();
  
  // Get admin user
  const user = await repo.findByUsername("admin");
  if (!user) {
    console.error("Admin user not found");
    await disconnectDB();
    Deno.exit(1);
  }

  const token = await jwt.generateToken({
    sub: String(user.id),
    username: user.username,
    fullName: user.fullName,
    roles: user.roles,
    permissions: user.permissions,
  });

  await disconnectDB();

  // Now test the endpoints
  console.log("--- HEALTH ---");
  const hRes = await fetch("http://127.0.0.1:8006/health");
  console.log("Status:", hRes.status);
  console.log("Body:", await hRes.text());

  console.log("\n--- ME (No Token) ---");
  const mRes = await fetch("http://127.0.0.1:8006/api/v1/auth/me");
  console.log("Status:", mRes.status);
  console.log("Body:", await mRes.text());

  console.log("\n--- ME (With Token) ---");
  const authRes = await fetch("http://127.0.0.1:8006/api/v1/auth/me", {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  console.log("Status:", authRes.status);
  const text = await authRes.text();
  console.log("Is JSON?", text.startsWith("{") ? "YES" : "NO");
  console.log("Body snippet:", text.substring(0, 150) + "...");
}

run();

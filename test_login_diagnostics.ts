import { client, connectDB, disconnectDB } from "./src/shared/infrastructure/database.ts";
import { BcryptPasswordService } from "./src/modules/auth/infrastructure/services/BcryptPasswordService.ts";
// deno-lint-ignore no-import-prefix
import { Secret } from "https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/secret.ts";

async function main() {
  const username = "fernando";
  const password = await Secret.prompt("Contraseña para fernando:");
  
  const response = await fetch("http://localhost:8000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: username, password })
  });

  console.log("HTTP Status:", response.status);
  const json = await response.json();
  console.log("JSON response:", json);
}

main().catch(console.error);

import { jwtService } from "../src/modules/auth/infrastructure/dependencies.ts";

async function main() {
  const token = await jwtService.generateToken({
    sub: 1,
    username: "admin",
    fullName: "Administrador",
    roles: ["ADMIN"],
    permissions: ["cash_session:open", "cash_session:close"],
  });

  const res = await fetch("http://localhost:8000/api/v1/cash-registers/sessions/active?registerId=1", {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  const json = await res.json();
  console.log("HTTP STATUS:", res.status);
  console.log("ENDPOINT RESPONSE:", JSON.stringify(json, null, 2));
}

main().catch(console.error);

import { Secret } from "https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/secret.ts";

async function main() {
  const users = ["fernando", "vanessa", "Paola", "jeni"];
  console.log("=== PRUEBA DE LOGIN DIRECTA AL BACKEND ===\n");

  for (const username of users) {
    const password = await Secret.prompt(`Contraseña para ${username}:`);
    if (!password) {
      console.log(`Saltando ${username}...\n`);
      continue;
    }

    try {
      const response = await fetch("http://localhost:8000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: username, password })
      });

      const json = await response.json();
      if (response.ok) {
        console.log(`✅ ${username} → autenticación: OK (HTTP ${response.status})`);
      } else {
        console.log(`❌ ${username} → autenticación: FAIL (HTTP ${response.status})`);
        console.log(`   Causa backend:`, json.error?.message || json.message);
      }
    } catch (e) {
      console.log(`❌ ${username} → Error de red/servidor: ${e.message}`);
    }
    console.log("");
  }
}

if (import.meta.main) {
  main().catch(console.error);
}

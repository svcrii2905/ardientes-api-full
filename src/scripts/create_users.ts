import { client, connectDB, disconnectDB } from "../shared/infrastructure/database.ts";
import { BcryptPasswordService } from "../modules/auth/infrastructure/services/BcryptPasswordService.ts";
// deno-lint-ignore no-import-prefix
import { Secret } from "https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/secret.ts";

const ROLES = {
  ADMIN: 1,
  CAJERO: 2,
  COCINA: 3,
  MESERO: 6,
};

const usersToCreate = [
  {
    firstName: "Fernando",
    roles: [ROLES.ADMIN],
  },
  {
    firstName: "Vanessa",
    roles: [ROLES.MESERO, ROLES.COCINA, ROLES.CAJERO],
  },
  {
    firstName: "Paola",
    roles: [ROLES.MESERO, ROLES.COCINA, ROLES.CAJERO],
  },
  {
    firstName: "Yeni",
    roles: [ROLES.MESERO, ROLES.COCINA, ROLES.CAJERO],
  },
];

async function main() {
  console.log("=========================================");
  console.log("🔐 ASISTENTE SEGURO DE CREACIÓN DE USUARIOS");
  console.log("=========================================\n");

  await connectDB();
  const passwordService = new BcryptPasswordService();

  for (const user of usersToCreate) {
    console.log(`\n--- Configurando usuario: ${user.firstName} ---`);
    
    // Check if user already exists
    const existing = await client.query("SELECT id FROM users WHERE full_name LIKE ?", [`%${user.firstName}%`]);
    if (existing.length > 0 && user.firstName !== "Fernando") {
       console.log(`⚠️  ${user.firstName} ya parece existir en la base de datos.`);
       const skip = prompt("¿Deseas omitirlo? (s/n):");
       if (skip?.toLowerCase() === "s") continue;
    }

    const username = prompt(`Username para ${user.firstName}:`);
    if (!username) {
      console.log("❌ Username es obligatorio. Saltando...");
      continue;
    }

    const email = prompt(`Email para ${user.firstName}:`);
    if (!email) {
      console.log("❌ Email es obligatorio. Saltando...");
      continue;
    }

    const password = await Secret.prompt(`Contraseña para ${user.firstName}:`);
    if (!password) {
      console.log("❌ Contraseña es obligatoria. Saltando...");
      continue;
    }

    const confirmPassword = await Secret.prompt(`Confirma la contraseña para ${user.firstName}:`);
    if (password !== confirmPassword) {
      console.log("❌ Las contraseñas no coinciden. Saltando...");
      continue;
    }

    const passwordHash = await passwordService.hash(password);

    console.log(`\nInsertando usuario ${username}...`);
    try {
      await client.transaction(async (conn) => {
        // En Fase 4 dejaremos el role_id principal del primer rol de compatibilidad temporal
        const mainRoleId = user.roles[0];
        
        const result = await conn.execute(
          "INSERT INTO users (username, email, password_hash, full_name, role_id, is_active) VALUES (?, ?, ?, ?, ?, 1)",
          [username, email, passwordHash, user.firstName, mainRoleId]
        );
        
        const userId = result.lastInsertId;
        
        // Insert user_roles
        for (const roleId of user.roles) {
          await conn.execute(
            "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
            [userId, roleId]
          );
        }
      });
      console.log(`✅ Usuario ${user.firstName} creado con éxito y roles asignados.`);
    } catch (err: any) {
      console.error(`❌ Error al crear usuario ${user.firstName}:`, err.message);
    }
  }

  await disconnectDB();
  console.log("\nProceso finalizado.");
}

if (import.meta.main) {
  main().catch(console.error);
}

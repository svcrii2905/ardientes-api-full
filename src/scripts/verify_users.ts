// verify_users.ts restored to original state
import { client, connectDB, disconnectDB } from "../shared/infrastructure/database.ts";
import { MySQLUserRepository } from "../modules/auth/infrastructure/mysql/MySQLUserRepository.ts";

async function main() {
  await connectDB();
  const repo = new MySQLUserRepository();
  
  console.log("=========================================");
  console.log("🔍 REPORTE DE VERIFICACIÓN DE USUARIOS");
  console.log("=========================================\n");

  const names = ["Fernando", "Vanessa", "Paola", "Yeni"];
  let hasDuplicates = false;
  let hasDuplicateRoles = false;

  for (const name of names) {
    // 1. Check for duplicates in DB
    const dbUsers: any[] = await client.query(
      "SELECT id, username, email, full_name, is_active FROM users WHERE full_name LIKE ?",
      [`%${name}%`]
    );

    if (dbUsers.length > 1) {
      console.log(`❌ ALERTA: Múltiples usuarios encontrados para ${name} (${dbUsers.length})`);
      hasDuplicates = true;
    } else if (dbUsers.length === 0) {
      console.log(`❌ ALERTA: No se encontró al usuario ${name}`);
      continue;
    }

    const dbUser = dbUsers[0];
    
    // Check duplicate user_roles
    const roleMappings: any[] = await client.query(
      "SELECT role_id, COUNT(*) as c FROM user_roles WHERE user_id = ? GROUP BY role_id HAVING c > 1",
      [dbUser.id]
    );
    if (roleMappings.length > 0) {
       console.log(`❌ ALERTA: Relaciones user_roles duplicadas para ${name}`);
       hasDuplicateRoles = true;
    }

    // Retrieve via Domain Repository to get deduplicated roles and permissions
    const user = await repo.findById(dbUser.id);
    if (!user) {
      console.log(`❌ ALERTA: UserRepository no devolvió al usuario ${name}`);
      continue;
    }

    const safeObj = user.toSafeObject();

    console.log(`👤 Usuario: ${safeObj.fullName}`);
    console.log(`   - ID: ${safeObj.id}`);
    console.log(`   - Username: ${safeObj.username}`);
    console.log(`   - Email: ${safeObj.email}`);
    console.log(`   - Activo: ${dbUser.is_active === 1 ? 'Sí' : 'No'}`);
    console.log(`   - Roles asignados: [${safeObj.roles.join(", ")}]`);
    console.log(`   - Total de permisos efectivos: ${safeObj.permissions.length}`);
    console.log(`   - Lista de permisos: \n${safeObj.permissions.join("\n    ")}\n`);
  }

  console.log("=========================================");
  console.log("📊 RESUMEN DE COMPROBACIONES");
  console.log("=========================================");
  if (!hasDuplicates) {
    console.log("✅ No existen usuarios duplicados.");
  }
  if (!hasDuplicateRoles) {
    console.log("✅ No existen relaciones user_roles duplicadas.");
  }
  console.log("✅ Ningún hash ni contraseña ha sido imprimido en este informe.");
  
  await disconnectDB();
}

if (import.meta.main) {
  main().catch(console.error);
}

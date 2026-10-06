import { connectDB, client, disconnectDB } from "../../../shared/infrastructure/database.ts";
import { User } from "../domain/User.ts";
import { MySQLUserRepository } from "../infrastructure/mysql/MySQLUserRepository.ts";
import { BcryptPasswordService } from "../infrastructure/services/BcryptPasswordService.ts";
import { JoseJwtService } from "../infrastructure/services/JoseJwtService.ts";
import { LoginUseCase } from "../application/use-cases/LoginUseCase.ts";
import { GetMeUseCase } from "../application/use-cases/GetMeUseCase.ts";
import { UnauthorizedError, ValidationError } from "../../../shared/domain/error.ts";

async function runTests() {
  console.log("==========================================================");
  console.log("🧪 INICIANDO PRUEBAS DEL MÓDULO DE AUTENTICACIÓN (FASE 2)");
  console.log("==========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  await connectDB();

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // 1. PRUEBAS DE SERVICIO BCRYPT
    // ──────────────────────────────────────────────────────────────────────────
    console.log("📌 1. Pruebas de BcryptPasswordService:");
    const passwordService = new BcryptPasswordService();
    const testPassword = "PasswordSegura123!";
    const hashedPassword = await passwordService.hash(testPassword);

    assert(typeof hashedPassword === "string" && (hashedPassword.startsWith("$2a$") || hashedPassword.startsWith("$2b$")), "Bcrypt genera un hash válido con prefijo estándar de bcrypt ($2a$ / $2b$)");
    assert(await passwordService.compare(testPassword, hashedPassword), "Bcrypt compara correctamente la contraseña válida (true)");
    assert(!(await passwordService.compare("PasswordErrada456!", hashedPassword)), "Bcrypt rechaza contraseña errónea (false)");

    // ──────────────────────────────────────────────────────────────────────────
    // 2. PRUEBAS DE SERVICIO JWT (JOSE)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n📌 2. Pruebas de JoseJwtService:");
    const jwtService = new JoseJwtService();
    const mockPayload = {
      sub: "42",
      username: "vanessa",
      fullName: "Vanessa Operaciones",
      roles: ["MESERO", "COCINA", "CAJERO"],
      permissions: ["orders:create", "orders:update_status", "payments:manage"],
    };

    const token = await jwtService.generateToken(mockPayload);
    assert(typeof token === "string" && token.split(".").length === 3, "JWT generado tiene formato estándar Header.Payload.Signature");

    const decoded = await jwtService.verifyToken(token);
    assert(decoded.sub === "42", "JWT payload conserva sub (ID)");
    assert(decoded.username === "vanessa", "JWT payload conserva username");
    assert(decoded.fullName === "Vanessa Operaciones", "JWT payload conserva fullName");
    assert(decoded.roles.length === 3 && decoded.roles.includes("MESERO"), "JWT payload contiene los roles asignados");
    assert(decoded.permissions.length === 3 && decoded.permissions.includes("payments:manage"), "JWT payload contiene los permisos");
    assert(typeof decoded.iat === "number" && typeof decoded.exp === "number", "JWT incluye timestamps iat y exp");
    assert(decoded.exp! - decoded.iat! === 12 * 3600, "JWT tiene expiración de 12 horas (43.200 segundos)");

    // ──────────────────────────────────────────────────────────────────────────
    // 3. PRUEBAS DE DOMINIO USER
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n📌 3. Pruebas de Dominio User:");
    const userDomain = new User({
      id: 2,
      username: "paola",
      email: "paola@ardientes.com",
      passwordHash: hashedPassword,
      fullName: "Paola Servicio",
      isActive: true,
      roles: ["MESERO", "COCINA", "CAJERO"],
      permissions: [
        "orders:create",
        "orders:update_status",
        "customers:manage",
        "payments:manage",
        "cash_session:open",
        "cash_session:close",
        "tables:read",
        "tables:orders",
        "tables:request_bill",
        "tables:transfer",
      ],
    });

    assert(userDomain.hasRole("MESERO"), "User.hasRole identifica rol existente");
    assert(!userDomain.hasRole("ADMIN"), "User.hasRole rechaza rol no asignado");
    assert(userDomain.hasPermission("tables:orders"), "User.hasPermission valida permiso presente");
    assert(!userDomain.hasPermission("config:write"), "User.hasPermission rechaza permiso administrativo ausente");
    assert(userDomain.hasAnyPermission(["config:write", "tables:orders"]), "User.hasAnyPermission retorna true si posee al menos uno");
    assert(!userDomain.hasAllPermissions(["tables:orders", "inventory:adjust"]), "User.hasAllPermissions retorna false si le falta uno");

    const safeObj = userDomain.toSafeObject();
    assert(!("passwordHash" in safeObj) && !("password_hash" in safeObj), "toSafeObject() NUNCA incluye passwordHash");

    // ──────────────────────────────────────────────────────────────────────────
    // 4. PRUEBAS DE REPOSITORIO MYSQL & USUARIO ADMIN REAL
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n📌 4. Pruebas de MySQLUserRepository con usuario ADMIN en BD:");
    const userRepo = new MySQLUserRepository();
    const adminUser = await userRepo.findByUsername("admin");

    assert(adminUser !== null, "Admin encontrado por username 'admin'");
    if (adminUser) {
      assert(adminUser.id === 1, "Admin tiene ID = 1");
      assert(adminUser.email === "admin@ardientes.com", "Admin email es admin@ardientes.com");
      assert(adminUser.roles.includes("ADMIN"), "Admin tiene rol 'ADMIN' cargado desde user_roles");
      assert(adminUser.permissions.length === 16, `Admin tiene los 16 permisos completos (encontrados: ${adminUser.permissions.length})`);
      assert(adminUser.hasPermission("config:write"), "Admin tiene permiso config:write");
      assert(adminUser.hasPermission("tables:request_bill"), "Admin tiene permiso de mesas tables:request_bill");
    }

    const adminByEmail = await userRepo.findByEmail("admin@ardientes.com");
    assert(adminByEmail !== null && adminByEmail.id === 1, "Admin encontrado correctamente por findByEmail");

    const adminById = await userRepo.findById(1);
    assert(adminById !== null && adminById.username === "admin", "Admin encontrado correctamente por findById");

    // ──────────────────────────────────────────────────────────────────────────
    // 5. PRUEBAS DE CÁLCULO MULTI-ROL (UNIÓN DE PERMISOS DEDUPLICADA)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n📌 5. Pruebas de Multi-Rol y Unión Deduplicada de Permisos:");
    // Verificamos permisos asignados a roles 2 (CAJERO), 3 (COCINA) y 6 (MESERO) en la base de datos
    const role2Perms = await client.query("SELECT p.code FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = 2");
    const role3Perms = await client.query("SELECT p.code FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = 3");
    const role6Perms = await client.query("SELECT p.code FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = 6");

    const allCombined = [
      ...role2Perms.map((r: any) => r.code),
      ...role3Perms.map((r: any) => r.code),
      ...role6Perms.map((r: any) => r.code),
    ];
    const uniqueCombined = Array.from(new Set(allCombined));

    assert(allCombined.length > uniqueCombined.length, "La suma bruta de permisos de los 3 roles contiene duplicados (ej: orders:update_status)");
    assert(uniqueCombined.length === 10, `La unión deduplicada de [MESERO, COCINA, CAJERO] da exactamente 10 permisos únicos (obtenidos: ${uniqueCombined.length})`);

    // ──────────────────────────────────────────────────────────────────────────
    // 6. PRUEBAS DE CASOS DE USO (LoginUseCase y GetMeUseCase)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n📌 6. Pruebas de Casos de Uso (LoginUseCase & GetMeUseCase):");
    const loginUseCase = new LoginUseCase(userRepo, passwordService, jwtService);
    const getMeUseCase = new GetMeUseCase(userRepo);

    // Test: Login con credenciales inválidas (debe lanzar UnauthorizedError genérico)
    let loginFailedAsExpected = false;
    try {
      await loginUseCase.execute({ identifier: "admin", password: "contrasena_incorrecta" });
    } catch (err) {
      if (err instanceof UnauthorizedError && err.message === "Credenciales de acceso inválidas") {
        loginFailedAsExpected = true;
      }
    }
    assert(loginFailedAsExpected, "LoginUseCase lanza UnauthorizedError genérico ante contraseña incorrecta (anti-enumeración)");

    // Test: Login con usuario inexistente (debe lanzar el MISMO UnauthorizedError genérico)
    let nonExistentFailedAsExpected = false;
    try {
      await loginUseCase.execute({ identifier: "usuario_que_no_existe", password: "123" });
    } catch (err) {
      if (err instanceof UnauthorizedError && err.message === "Credenciales de acceso inválidas") {
        nonExistentFailedAsExpected = true;
      }
    }
    assert(nonExistentFailedAsExpected, "LoginUseCase lanza el mismo UnauthorizedError genérico ante usuario inexistente");

    // Test: Login con inputs vacíos
    let validationFailedAsExpected = false;
    try {
      await loginUseCase.execute({ identifier: "", password: "" });
    } catch (err) {
      if (err instanceof ValidationError) {
        validationFailedAsExpected = true;
      }
    }
    assert(validationFailedAsExpected, "LoginUseCase valida campos obligatorios lanzando ValidationError");

    // Test: GetMeUseCase con ID de Admin
    const meResult = await getMeUseCase.execute(1);
    assert(meResult.id === 1 && meResult.username === "admin", "GetMeUseCase retorna el perfil de admin");
    assert(meResult.roles.includes("ADMIN"), "GetMeUseCase incluye roles");
    assert(meResult.permissions.length === 16, "GetMeUseCase incluye permisos");
    assert(!("passwordHash" in meResult) && !("password_hash" in (meResult as any)), "GetMeUseCase no expone password_hash");

  } finally {
    await disconnectDB();
  }

  console.log("\n==========================================================");
  console.log(`📊 RESULTADOS: ${passed} PASADAS | ${failed} FALLIDAS`);
  console.log("==========================================================");

  if (failed > 0) {
    Deno.exit(1);
  }
}

if (import.meta.main) {
  runTests();
}

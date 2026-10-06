import { Application } from "oak";
import { connectDB, disconnectDB, client } from "../shared/infrastructure/database.ts";
import { authRouter } from "../modules/auth/infrastructure/http/router.ts";
import { errorMiddleware } from "../shared/infrastructure/middleware/error.middleware.ts";
import { securityHeadersMiddleware } from "../shared/infrastructure/middleware/securityHeaders.middleware.ts";
import { mailService, passwordService } from "../modules/auth/infrastructure/dependencies.ts";
import { hashVerificationCode } from "../modules/auth/application/utils/codeGenerator.ts";

async function main() {
  console.log("===============================================================");
  console.log("🚀 INICIANDO PRUEBAS FUNCIONALES COMPLETAS (LOCAL / DEV)");
  console.log("===============================================================\n");

  await connectDB();

  // Configurar aplicación Oak local para pruebas
  const app = new Application();
  app.use(securityHeadersMiddleware);
  app.use(errorMiddleware);
  app.use(authRouter.routes());
  app.use(authRouter.allowedMethods());

  // Interceptor para capturar el código enviado y a la vez despachar el correo real vía SMTP
  let lastCapturedCode = "";
  let lastCapturedType = "";
  let lastCapturedRecipient = "";
  const originalSendVerificationCode = mailService.sendVerificationCode.bind(mailService);

  mailService.sendVerificationCode = async (dto) => {
    lastCapturedCode = dto.code;
    lastCapturedType = dto.type;
    lastCapturedRecipient = dto.to;
    return await originalSendVerificationCode(dto);
  };

  // Helper para hacer peticiones HTTP simuladas al Oak Application
  async function api(path: string, options: { method?: string; body?: any; token?: string } = {}) {
    const headers = new Headers();
    if (options.body) headers.set("Content-Type", "application/json");
    if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

    const req = new Request(`http://localhost:8000${path}`, {
      method: options.method || (options.body ? "POST" : "GET"),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const res = await app.handle(req);
    if (!res) throw new Error(`No response for ${path}`);
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json };
  }

  const TEST_EMAIL = "foodardientes@gmail.com";
  let testUserId1 = 0;
  let testUserId2 = 0;

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // PREPARACIÓN DE USUARIOS DE PRUEBA
    // ──────────────────────────────────────────────────────────────────────────
    console.log("📦 Preparando usuarios de prueba en la base de datos...");
    
    // Limpiar usuarios de prueba anteriores si existieran
    await client.execute("DELETE FROM users WHERE username IN ('test_recuperacion_pos', 'test_sin_correo_pos')");

    const initialHash = await passwordService.hash("ClaveInicial123!");

    // Usuario 1: Para prueba de recuperación de contraseña (con correo válido)
    const res1 = await client.execute(
      "INSERT INTO users (username, email, password_hash, full_name, role_id, is_active, token_version) VALUES (?, ?, ?, ?, 6, 1, 1)",
      ["test_recuperacion_pos", TEST_EMAIL, initialHash, "Usuario Prueba Recuperación"]
    );
    testUserId1 = res1.lastInsertId!;

    // Asignar rol
    await client.execute("INSERT INTO user_roles (user_id, role_id) VALUES (?, 6)", [testUserId1]);

    // Usuario 2: Para prueba de usuario sin correo válido (placeholder)
    const res2 = await client.execute(
      "INSERT INTO users (username, email, password_hash, full_name, role_id, is_active, token_version) VALUES (?, ?, ?, ?, 6, 1, 1)",
      ["test_sin_correo_pos", "sin_correo_temp", initialHash, "Usuario Sin Correo"]
    );
    testUserId2 = res2.lastInsertId!;
    await client.execute("INSERT INTO user_roles (user_id, role_id) VALUES (?, 6)", [testUserId2]);

    console.log(`✅ Usuarios de prueba creados (ID 1: ${testUserId1}, ID 2: ${testUserId2})\n`);

    // ──────────────────────────────────────────────────────────────────────────
    // PRUEBA 1 — RECUPERACIÓN DE CONTRASEÑA
    // ──────────────────────────────────────────────────────────────────────────
    console.log("---------------------------------------------------------------");
    console.log("PRUEBA 1 — RECUPERACIÓN DE CONTRASEÑA");
    console.log("---------------------------------------------------------------");

    // 1.1 Iniciar sesión previa para obtener token anterior
    const loginPre = await api("/api/v1/auth/login", {
      body: { identifier: "test_recuperacion_pos", password: "ClaveInicial123!" },
    });
    if (loginPre.status !== 200) throw new Error("Fallo al iniciar sesión inicial");
    const preSessionToken = loginPre.body.data.accessToken;
    console.log("1.1 Sesión inicial establecida y token previo obtenido.");

    // 1.2 Solicitar recuperación
    console.log(`1.2 Solicitando código para ${TEST_EMAIL}...`);
    const forgotRes = await api("/api/v1/auth/forgot-password", {
      body: { email: TEST_EMAIL },
    });
    if (forgotRes.status !== 200 || !forgotRes.body.success) {
      throw new Error(`Fallo en forgot-password: ${JSON.stringify(forgotRes.body)}`);
    }
    console.log(`✅ Código solicitado. Mensaje del servidor: "${forgotRes.body.message}"`);
    console.log(`✅ Correo real enviado vía Gmail SMTP a: ${lastCapturedRecipient}`);
    console.log(`✅ Código de 6 dígitos generado: [${lastCapturedCode}]`);

    // 1.3 Verificar código incorrecto
    const badCodeRes = await api("/api/v1/auth/verify-reset-code", {
      body: { email: TEST_EMAIL, code: "000000" },
    });
    if (badCodeRes.status !== 400) throw new Error("El código incorrecto debió ser rechazado");
    console.log("✅ Código incorrecto rechazado con status 400.");

    // 1.4 Verificar código correcto
    const verifyRes = await api("/api/v1/auth/verify-reset-code", {
      body: { email: TEST_EMAIL, code: lastCapturedCode },
    });
    if (verifyRes.status !== 200 || !verifyRes.body.data?.resetToken) {
      throw new Error(`Fallo en verify-reset-code: ${JSON.stringify(verifyRes.body)}`);
    }
    const resetToken = verifyRes.body.data.resetToken;
    console.log("✅ Código de 6 dígitos verificado exitosamente. ResetToken emitido.");

    // 1.5 Restablecer contraseña con resetToken
    const newPassword = "NuevaClaveSuperSegura456!";
    const resetRes = await api("/api/v1/auth/reset-password", {
      body: { resetToken, newPassword },
    });
    if (resetRes.status !== 200 || !resetRes.body.success) {
      throw new Error(`Fallo en reset-password: ${JSON.stringify(resetRes.body)}`);
    }
    console.log(`✅ Contraseña restablecida exitosamente: "${resetRes.body.message}"`);

    // 1.6 Login con nueva contraseña
    const loginPost = await api("/api/v1/auth/login", {
      body: { identifier: "test_recuperacion_pos", password: newPassword },
    });
    if (loginPost.status !== 200) throw new Error("Fallo al iniciar sesión con la nueva contraseña");
    console.log("✅ Inicio de sesión exitoso con la nueva contraseña.");

    // 1.7 Confirmar que la contraseña anterior ya no funciona
    const loginOld = await api("/api/v1/auth/login", {
      body: { identifier: "test_recuperacion_pos", password: "ClaveInicial123!" },
    });
    if (loginOld.status !== 401) throw new Error("La contraseña anterior debió ser rechazada con 401");
    console.log("✅ Contraseña anterior rechazada con status 401.");

    // 1.8 Confirmar que el resetToken no puede reutilizarse
    const reuseReset = await api("/api/v1/auth/reset-password", {
      body: { resetToken, newPassword: "OtraClaveMas789!" },
    });
    if (reuseReset.status !== 400) throw new Error("El resetToken reutilizado debió ser rechazado con 400");
    console.log("✅ Reutilización de resetToken rechazada con status 400.");

    // 1.9 Confirmar que la sesión anterior quedó invalidada por token_version
    const meWithOldToken = await api("/api/v1/auth/me", {
      token: preSessionToken,
    });
    if (meWithOldToken.status !== 401) {
      throw new Error("El token anterior debió ser revocado por token_version");
    }
    console.log("✅ Sesión anterior revocada exitosamente por token_version (status 401).\n");

    // ──────────────────────────────────────────────────────────────────────────
    // PRUEBA 2 — USUARIO SIN CORREO VÁLIDO
    // ──────────────────────────────────────────────────────────────────────────
    console.log("---------------------------------------------------------------");
    console.log("PRUEBA 2 — USUARIO SIN CORREO VÁLIDO");
    console.log("---------------------------------------------------------------");

    // 2.1 Login del usuario sin correo válido
    const loginNoEmail = await api("/api/v1/auth/login", {
      body: { identifier: "test_sin_correo_pos", password: "ClaveInicial123!" },
    });
    if (loginNoEmail.status !== 200) throw new Error("Fallo en login de usuario sin correo");
    const noEmailUser = loginNoEmail.body.data.user;
    const noEmailToken = loginNoEmail.body.data.accessToken;

    // 2.2 Detección de email inválido
    const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(noEmailUser.email);
    if (hasValidEmail) throw new Error("El usuario no debió tener email válido inicialmente");
    console.log(`2.1 Usuario inició sesión. Correo detectado: "${noEmailUser.email}" (Inválido: activa modal).`);

    // 2.3 Rechazo de contraseña actual incorrecta al solicitar vincular correo
    const badPassSetup = await api("/api/v1/auth/email-setup/request", {
      token: noEmailToken,
      body: { currentPassword: "PasswordErrado", newEmail: TEST_EMAIL },
    });
    if (badPassSetup.status !== 401) throw new Error("Debió rechazar contraseña actual incorrecta con 401");
    console.log("✅ Solicitud con contraseña actual incorrecta rechazada con status 401.");

    // 2.4 Rechazo de correo duplicado (ya pertenece a test_recuperacion_pos)
    const duplicateEmailSetup = await api("/api/v1/auth/email-setup/request", {
      token: noEmailToken,
      body: { currentPassword: "ClaveInicial123!", newEmail: TEST_EMAIL },
    });
    if (duplicateEmailSetup.status !== 400) throw new Error("Debió rechazar correo duplicado con status 400");
    console.log("✅ Intento de registrar correo ya existente en otra cuenta rechazado con status 400.");

    // 2.5 Solicitar vinculación con un correo disponible
    // Cambiamos el correo del usuario 1 para liberar TEST_EMAIL para el usuario 2
    await client.execute("UPDATE users SET email = 'liberado@ardientes.com' WHERE id = ?", [testUserId1]);

    const validSetupReq = await api("/api/v1/auth/email-setup/request", {
      token: noEmailToken,
      body: { currentPassword: "ClaveInicial123!", newEmail: TEST_EMAIL },
    });
    if (validSetupReq.status !== 200) {
      throw new Error(`Fallo en email-setup/request: ${JSON.stringify(validSetupReq.body)}`);
    }
    console.log(`✅ Solicitud de vinculación aceptada. Correo real enviado a: ${lastCapturedRecipient}`);
    console.log(`✅ Código de verificación de correo capturado: [${lastCapturedCode}]`);

    // 2.6 Confirmar código y asociar correo
    const confirmSetup = await api("/api/v1/auth/email-setup/confirm", {
      token: noEmailToken,
      body: { email: TEST_EMAIL, code: lastCapturedCode },
    });
    if (confirmSetup.status !== 200 || confirmSetup.body.data?.user?.email !== TEST_EMAIL) {
      throw new Error(`Fallo en email-setup/confirm: ${JSON.stringify(confirmSetup.body)}`);
    }
    console.log(`✅ Correo verificado y asociado con éxito a la cuenta del usuario: ${confirmSetup.body.data.user.email}`);

    // 2.7 Confirmar en la base de datos que el correo quedó guardado
    const [dbUser2] = await client.query("SELECT email FROM users WHERE id = ?", [testUserId2]);
    if (dbUser2.email !== TEST_EMAIL) throw new Error("El correo en base de datos no coincide");
    console.log("✅ Verificado en MySQL: users.email actualizado correctamente.\n");

    // ──────────────────────────────────────────────────────────────────────────
    // PRUEBA 3 — CAMBIO DE CONTRASEÑA AUTENTICADO
    // ──────────────────────────────────────────────────────────────────────────
    console.log("---------------------------------------------------------------");
    console.log("PRUEBA 3 — CAMBIO DE CONTRASEÑA AUTENTICADO");
    console.log("---------------------------------------------------------------");

    // 3.1 Rechazo de contraseña actual incorrecta
    const badChange = await api("/api/v1/auth/change-password", {
      token: noEmailToken,
      body: { currentPassword: "PasswordIncorrecto", newPassword: "NuevaClaveAutenticada999!" },
    });
    if (badChange.status !== 401) throw new Error("Debió rechazar cambio con contraseña actual errónea");
    console.log("✅ Cambio con contraseña actual errónea rechazado con 401.");

    // 3.2 Cambio exitoso
    const okChange = await api("/api/v1/auth/change-password", {
      token: noEmailToken,
      body: { currentPassword: "ClaveInicial123!", newPassword: "NuevaClaveAutenticada999!" },
    });
    if (okChange.status !== 200) throw new Error("Fallo en change-password");
    console.log(`✅ Contraseña cambiada exitosamente: "${okChange.body.message}"`);

    // 3.3 Confirmar que el token previo quedó invalidado por token_version
    const meWithRevoked = await api("/api/v1/auth/me", {
      token: noEmailToken,
    });
    if (meWithRevoked.status !== 401) throw new Error("La sesión previa debió ser revocada con 401");
    console.log("✅ Sesión previa revocada con status 401 tras cambio de contraseña.");

    // 3.4 Login con la nueva contraseña
    const newLogin = await api("/api/v1/auth/login", {
      body: { identifier: "test_sin_correo_pos", password: "NuevaClaveAutenticada999!" },
    });
    if (newLogin.status !== 200) throw new Error("Fallo en login con nueva contraseña");
    console.log("✅ Inicio de sesión exitoso con la nueva contraseña cambiada.\n");

    // ──────────────────────────────────────────────────────────────────────────
    // PRUEBA 4 — SEGURIDAD INTEGRAL
    // ──────────────────────────────────────────────────────────────────────────
    console.log("---------------------------------------------------------------");
    console.log("PRUEBA 4 — SEGURIDAD INTEGRAL");
    console.log("---------------------------------------------------------------");

    // 4.1 Límite de 3 intentos
    await api("/api/v1/auth/forgot-password", { body: { email: TEST_EMAIL } });
    const codeToFail = "888888";
    for (let i = 1; i <= 3; i++) {
      const r = await api("/api/v1/auth/verify-reset-code", {
        body: { email: TEST_EMAIL, code: codeToFail },
      });
      const errMsg = r.body.error?.message || r.body.message;
      console.log(`  Intento erróneo ${i}/3: status ${r.status} (${errMsg})`);
    }
    // El 4to intento con el código correcto debe ser bloqueado por límite de intentos
    const blockedRes = await api("/api/v1/auth/verify-reset-code", {
      body: { email: TEST_EMAIL, code: lastCapturedCode },
    });
    const blockedMsg = blockedRes.body.error?.message || blockedRes.body.message || "";
    if (blockedRes.status !== 400 || !blockedMsg.includes("límite de 3 intentos")) {
      throw new Error(`Debió bloquear tras 3 intentos fallidos: ${blockedMsg}`);
    }
    console.log("✅ Código bloqueado tras superar 3 intentos erróneos.");

    // 4.2 Código expirado
    const expiredHash = await hashVerificationCode("112233");
    const expRes = await client.execute(
      "INSERT INTO auth_verification_codes (user_id, type, target_email, code_hash, expires_at, attempts) VALUES (?, 'PASSWORD_RESET', ?, ?, DATE_SUB(NOW(), INTERVAL 1 HOUR), 0)",
      [testUserId2, TEST_EMAIL, expiredHash]
    );
    const expiredTry = await api("/api/v1/auth/verify-reset-code", {
      body: { email: TEST_EMAIL, code: "112233" },
    });
    const expMsg = expiredTry.body.error?.message || expiredTry.body.message || "";
    if (expiredTry.status !== 400 || !expMsg.includes("expirado")) {
      throw new Error(`El código expirado debió ser rechazado: ${expMsg}`);
    }
    console.log("✅ Código con fecha expirada rechazado con status 400.");

    // 4.3 resetToken no funciona como Bearer JWT normal en endpoints protegidos
    const testResetToken = (await api("/api/v1/auth/verify-reset-code", {
      body: { email: TEST_EMAIL, code: lastCapturedCode },
    })).body?.data?.resetToken;

    // Generar un resetToken válido directamente para probar
    const { jwtService } = await import("../modules/auth/infrastructure/dependencies.ts");
    const sampleResetToken = await jwtService.generateResetToken({
      userId: testUserId2,
      email: TEST_EMAIL,
      codeId: expRes.lastInsertId!,
    });

    const accessProtectedWithResetToken = await api("/api/v1/auth/me", {
      token: sampleResetToken,
    });
    if (accessProtectedWithResetToken.status !== 401) {
      throw new Error("resetToken debió ser rechazado por authMiddleware");
    }
    console.log("✅ resetToken rechazado por authMiddleware (no permite acceso a recursos protegidos).");

    // 4.4 Anti-enumeración de usuarios
    const nonExistent = await api("/api/v1/auth/forgot-password", {
      body: { email: "usuario_que_no_existe_999@gmail.com" },
    });
    if (nonExistent.status !== 200 || !nonExistent.body.message.includes("Si el correo electrónico está registrado")) {
      throw new Error("Fallo en respuesta anti-enumeración");
    }
    console.log("✅ Anti-enumeración: Correo inexistente recibe respuesta idéntica de éxito.");

    // 4.5 Verificar que los códigos en BD se guardaron exclusivamente como hash
    const rows = await client.query("SELECT code_hash FROM auth_verification_codes WHERE user_id = ?", [testUserId2]);
    for (const row of rows) {
      if (row.code_hash.length !== 64) {
        throw new Error("El hash del código no tiene formato SHA-256 (64 hex chars)");
      }
    }
    console.log("✅ Todos los códigos están guardados exclusivamente como hash SHA-256 (64 hex chars).");

    console.log("\n===============================================================");
    console.log("🎉 TODAS LAS PRUEBAS FUNCIONALES PASARON CON ÉXITO AL 100%");
    console.log("===============================================================\n");

  } finally {
    // Restaurar interceptor de correo
    mailService.sendVerificationCode = originalSendVerificationCode;

    // Limpieza estricta de usuarios y códigos de prueba
    console.log("🧹 Limpiando registros de prueba de la base de datos...");
    if (testUserId1) {
      await client.execute("DELETE FROM users WHERE id = ?", [testUserId1]);
    }
    if (testUserId2) {
      await client.execute("DELETE FROM users WHERE id = ?", [testUserId2]);
    }
    console.log("✅ Base de datos restaurada al estado original.");
    await disconnectDB();
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("❌ ERROR EN PRUEBA FUNCIONAL:", err);
    Deno.exit(1);
  });
}

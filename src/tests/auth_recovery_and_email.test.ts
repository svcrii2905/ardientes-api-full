import { assertEquals, assertRejects, assert } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { User } from "../modules/auth/domain/User.ts";
import { UserRepository } from "../modules/auth/domain/UserRepository.ts";
import {
  AuthVerificationCode,
  VerificationCodeType,
} from "../modules/auth/domain/AuthVerificationCode.ts";
import {
  AuthVerificationRepository,
  CreateVerificationCodeDTO,
} from "../modules/auth/domain/AuthVerificationRepository.ts";
import { MailService, SendVerificationCodeDTO } from "../modules/auth/domain/services/MailService.ts";
import { BcryptPasswordService } from "../modules/auth/infrastructure/services/BcryptPasswordService.ts";
import { JoseJwtService } from "../modules/auth/infrastructure/services/JoseJwtService.ts";

import { RequestPasswordResetUseCase } from "../modules/auth/application/use-cases/RequestPasswordResetUseCase.ts";
import { VerifyResetCodeUseCase } from "../modules/auth/application/use-cases/VerifyResetCodeUseCase.ts";
import { ResetPasswordUseCase } from "../modules/auth/application/use-cases/ResetPasswordUseCase.ts";
import { ChangePasswordUseCase } from "../modules/auth/application/use-cases/ChangePasswordUseCase.ts";
import { RequestEmailSetupUseCase } from "../modules/auth/application/use-cases/RequestEmailSetupUseCase.ts";
import { ConfirmEmailSetupUseCase } from "../modules/auth/application/use-cases/ConfirmEmailSetupUseCase.ts";
import { hashVerificationCode } from "../modules/auth/application/utils/codeGenerator.ts";
import { authMiddleware } from "../shared/infrastructure/middleware/auth.middleware.ts";
import { Context } from "oak";

// ─── Mock Implementations ───────────────────────────────────────────────────

class MockUserRepository implements UserRepository {
  public users: Map<number, User> = new Map();
  private nextId = 1;

  async findByUsername(username: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.username.toLowerCase() === username.toLowerCase()) return u;
    }
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  }

  async findById(id: number): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async listActiveUsers(): Promise<User[]> {
    return Array.from(this.users.values()).filter((u) => u.isActive);
  }

  async updateLastLogin(_userId: number): Promise<void> {}

  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    const existing = this.users.get(userId);
    if (!existing) return;
    const updated = new User({
      id: existing.id,
      username: existing.username,
      email: existing.email,
      passwordHash,
      fullName: existing.fullName,
      isActive: existing.isActive,
      tokenVersion: (existing.tokenVersion ?? 1) + 1,
      roles: existing.roles,
      permissions: existing.permissions,
    });
    this.users.set(userId, updated);
  }

  async updateEmail(userId: number, email: string): Promise<void> {
    const existing = this.users.get(userId);
    if (!existing) return;
    const updated = new User({
      id: existing.id,
      username: existing.username,
      email,
      passwordHash: existing.passwordHash,
      fullName: existing.fullName,
      isActive: existing.isActive,
      tokenVersion: existing.tokenVersion,
      roles: existing.roles,
      permissions: existing.permissions,
    });
    this.users.set(userId, updated);
  }

  addUser(props: { username: string; email: string; passwordHash: string; fullName: string; isActive?: boolean; tokenVersion?: number }): User {
    const id = this.nextId++;
    const user = new User({
      id,
      username: props.username,
      email: props.email,
      passwordHash: props.passwordHash,
      fullName: props.fullName,
      isActive: props.isActive ?? true,
      tokenVersion: props.tokenVersion ?? 1,
      roles: ["MESERO"],
      permissions: ["tables:read"],
    });
    this.users.set(id, user);
    return user;
  }
}

class MockAuthVerificationRepository implements AuthVerificationRepository {
  public codes: Map<number, AuthVerificationCode> = new Map();
  private nextId = 1;

  async create(dto: CreateVerificationCodeDTO): Promise<AuthVerificationCode> {
    const id = this.nextId++;
    const code = new AuthVerificationCode({
      id,
      userId: dto.userId,
      type: dto.type,
      targetEmail: dto.targetEmail,
      codeHash: dto.codeHash,
      expiresAt: dto.expiresAt,
      attempts: 0,
      usedAt: null,
      ipAddress: dto.ipAddress,
      createdAt: new Date(),
    });
    this.codes.set(id, code);
    return code;
  }

  async findLatestActive(
    userId: number,
    targetEmail: string,
    type: VerificationCodeType
  ): Promise<AuthVerificationCode | null> {
    const matching = Array.from(this.codes.values())
      .filter((c) => c.userId === userId && c.targetEmail.toLowerCase() === targetEmail.toLowerCase() && c.type === type && !c.isUsed())
      .sort((a, b) => b.id - a.id);

    return matching[0] ?? null;
  }

  async findById(id: number): Promise<AuthVerificationCode | null> {
    return this.codes.get(id) ?? null;
  }

  async incrementAttempts(id: number): Promise<void> {
    const existing = this.codes.get(id);
    if (!existing) return;
    const updated = new AuthVerificationCode({
      id: existing.id,
      userId: existing.userId,
      type: existing.type,
      targetEmail: existing.targetEmail,
      codeHash: existing.codeHash,
      expiresAt: existing.expiresAt,
      attempts: existing.attempts + 1,
      usedAt: existing.usedAt,
      ipAddress: existing.ipAddress,
      createdAt: existing.createdAt,
    });
    this.codes.set(id, updated);
  }

  async markAsUsed(id: number): Promise<void> {
    const existing = this.codes.get(id);
    if (!existing) return;
    const updated = new AuthVerificationCode({
      id: existing.id,
      userId: existing.userId,
      type: existing.type,
      targetEmail: existing.targetEmail,
      codeHash: existing.codeHash,
      expiresAt: existing.expiresAt,
      attempts: existing.attempts,
      usedAt: new Date(),
      ipAddress: existing.ipAddress,
      createdAt: existing.createdAt,
    });
    this.codes.set(id, updated);
  }

  async countRecentRequests(
    userId: number | null,
    targetEmail: string,
    _windowMinutes: number
  ): Promise<number> {
    return Array.from(this.codes.values()).filter(
      (c) => c.targetEmail.toLowerCase() === targetEmail.toLowerCase() || (userId !== null && c.userId === userId)
    ).length;
  }
}

class MockMailService implements MailService {
  public sentEmails: SendVerificationCodeDTO[] = [];

  async sendVerificationCode(dto: SendVerificationCodeDTO): Promise<void> {
    this.sentEmails.push(dto);
  }
}

// ─── Tests Suite ─────────────────────────────────────────────────────────────

Deno.test("Auth Suite - 1. Código válido y recuperación completa", async () => {
  const userRepo = new MockUserRepository();
  const verificationRepo = new MockAuthVerificationRepository();
  const mailService = new MockMailService();
  const passwordService = new BcryptPasswordService();
  const jwtService = new JoseJwtService("secret_test_key_minimum_32_characters_long");

  const initialHash = await passwordService.hash("OldPassword123");
  const user = userRepo.addUser({
    username: "fernando",
    email: "fernando@ardientes.com",
    passwordHash: initialHash,
    fullName: "Fernando Saenz",
  });

  const requestUseCase = new RequestPasswordResetUseCase(userRepo, verificationRepo, mailService);
  const verifyUseCase = new VerifyResetCodeUseCase(userRepo, verificationRepo, jwtService);
  const resetUseCase = new ResetPasswordUseCase(userRepo, verificationRepo, jwtService, passwordService);

  // Solicitar recuperación
  const reqResult = await requestUseCase.execute({ email: "fernando@ardientes.com" });
  assert(reqResult.message.includes("código"));
  assertEquals(mailService.sentEmails.length, 1);

  const sentCode = mailService.sentEmails[0].code;
  assertEquals(sentCode.length, 6);

  // Verificar código correcto
  const verifyResult = await verifyUseCase.execute({ email: "fernando@ardientes.com", code: sentCode });
  assert(verifyResult.resetToken.length > 20);

  // Establecer nueva contraseña
  const resetResult = await resetUseCase.execute({
    resetToken: verifyResult.resetToken,
    newPassword: "NewSecretPassword2026!",
  });
  assert(resetResult.message.includes("actualizada"));

  // Verificar que la nueva contraseña funcione y la antigua sea rechazada
  const updatedUser = await userRepo.findById(user.id);
  const isOldValid = await passwordService.compare("OldPassword123", updatedUser!.passwordHash);
  const isNewValid = await passwordService.compare("NewSecretPassword2026!", updatedUser!.passwordHash);
  assertEquals(isOldValid, false);
  assertEquals(isNewValid, true);
  assertEquals(updatedUser!.tokenVersion, 2); // token_version incrementado
});

Deno.test("Auth Suite - 2. Código incorrecto e incremento de intentos", async () => {
  const userRepo = new MockUserRepository();
  const verificationRepo = new MockAuthVerificationRepository();
  const mailService = new MockMailService();
  const jwtService = new JoseJwtService("secret_test_key_minimum_32_characters_long");

  userRepo.addUser({
    username: "paola",
    email: "paola@ardientes.com",
    passwordHash: "hash",
    fullName: "Paola",
  });

  const requestUseCase = new RequestPasswordResetUseCase(userRepo, verificationRepo, mailService);
  const verifyUseCase = new VerifyResetCodeUseCase(userRepo, verificationRepo, jwtService);

  await requestUseCase.execute({ email: "paola@ardientes.com" });

  await assertRejects(
    async () => {
      await verifyUseCase.execute({ email: "paola@ardientes.com", code: "000000" });
    },
    Error,
    "incorrecto"
  );

  const codeEntity = await verificationRepo.findLatestActive(1, "paola@ardientes.com", "PASSWORD_RESET");
  assertEquals(codeEntity?.attempts, 1);
});

Deno.test("Auth Suite - 3. Bloqueo al superar 3 intentos máximos", async () => {
  const userRepo = new MockUserRepository();
  const verificationRepo = new MockAuthVerificationRepository();
  const mailService = new MockMailService();
  const jwtService = new JoseJwtService("secret_test_key_minimum_32_characters_long");

  userRepo.addUser({
    username: "jeni",
    email: "jeni@ardientes.com",
    passwordHash: "hash",
    fullName: "Yeni",
  });

  const requestUseCase = new RequestPasswordResetUseCase(userRepo, verificationRepo, mailService);
  const verifyUseCase = new VerifyResetCodeUseCase(userRepo, verificationRepo, jwtService);

  await requestUseCase.execute({ email: "jeni@ardientes.com" });

  // 3 intentos fallidos
  for (let i = 0; i < 3; i++) {
    try {
      await verifyUseCase.execute({ email: "jeni@ardientes.com", code: "999999" });
    } catch {
      // expected failure
    }
  }

  // Cuarto intento debe ser rechazado por límite de intentos
  await assertRejects(
    async () => {
      await verifyUseCase.execute({ email: "jeni@ardientes.com", code: mailService.sentEmails[0].code });
    },
    Error,
    "límite de 3 intentos"
  );
});

Deno.test("Auth Suite - 4. Código expirado rechazado", async () => {
  const userRepo = new MockUserRepository();
  const verificationRepo = new MockAuthVerificationRepository();
  const jwtService = new JoseJwtService("secret_test_key_minimum_32_characters_long");

  const user = userRepo.addUser({
    username: "vane",
    email: "vane@ardientes.com",
    passwordHash: "hash",
    fullName: "Vanessa",
  });

  // Código con fecha de expiración en el pasado
  const pastDate = new Date(Date.now() - 60000);
  const codeHash = await hashVerificationCode("123456");
  await verificationRepo.create({
    userId: user.id,
    type: "PASSWORD_RESET",
    targetEmail: "vane@ardientes.com",
    codeHash,
    expiresAt: pastDate,
  });

  const verifyUseCase = new VerifyResetCodeUseCase(userRepo, verificationRepo, jwtService);

  await assertRejects(
    async () => {
      await verifyUseCase.execute({ email: "vane@ardientes.com", code: "123456" });
    },
    Error,
    "expirado"
  );
});

Deno.test("Auth Suite - 5. Código usado no puede ser reutilizado", async () => {
  const userRepo = new MockUserRepository();
  const verificationRepo = new MockAuthVerificationRepository();
  const passwordService = new BcryptPasswordService();
  const jwtService = new JoseJwtService("secret_test_key_minimum_32_characters_long");

  const user = userRepo.addUser({
    username: "fernando",
    email: "f@ardientes.com",
    passwordHash: "hash",
    fullName: "Fernando",
  });

  const codeHash = await hashVerificationCode("654321");
  const code = await verificationRepo.create({
    userId: user.id,
    type: "PASSWORD_RESET",
    targetEmail: "f@ardientes.com",
    codeHash,
    expiresAt: new Date(Date.now() + 600000),
  });

  // Marcar como usado
  await verificationRepo.markAsUsed(code.id);

  const verifyUseCase = new VerifyResetCodeUseCase(userRepo, verificationRepo, jwtService);

  await assertRejects(
    async () => {
      await verifyUseCase.execute({ email: "f@ardientes.com", code: "654321" });
    },
    Error,
    "expirado o ya fue utilizado"
  );
});

Deno.test("Auth Suite - 6. Rate Limiting de solicitudes por correo", async () => {
  const userRepo = new MockUserRepository();
  const verificationRepo = new MockAuthVerificationRepository();
  const mailService = new MockMailService();

  userRepo.addUser({
    username: "user",
    email: "user@ardientes.com",
    passwordHash: "hash",
    fullName: "User Test",
  });

  const requestUseCase = new RequestPasswordResetUseCase(userRepo, verificationRepo, mailService);

  // 3 solicitudes permitidas
  await requestUseCase.execute({ email: "user@ardientes.com" });
  await requestUseCase.execute({ email: "user@ardientes.com" });
  await requestUseCase.execute({ email: "user@ardientes.com" });

  // Cuarta solicitud debe ser bloqueada por rate limit
  await assertRejects(
    async () => {
      await requestUseCase.execute({ email: "user@ardientes.com" });
    },
    Error,
    "demasiadas solicitudes"
  );
});

Deno.test("Auth Suite - 7. Anti-enumeración de usuarios en solicitud", async () => {
  const userRepo = new MockUserRepository();
  const verificationRepo = new MockAuthVerificationRepository();
  const mailService = new MockMailService();

  const requestUseCase = new RequestPasswordResetUseCase(userRepo, verificationRepo, mailService);

  // Correo que no existe en el sistema
  const res = await requestUseCase.execute({ email: "noexiste@correo.com" });
  assert(res.message.includes("Si el correo electrónico está registrado"));
  assertEquals(mailService.sentEmails.length, 0); // No se envía nada pero no da error
});

Deno.test("Auth Suite - 8. Vinculación de correo y rechazo de correo duplicado", async () => {
  const userRepo = new MockUserRepository();
  const verificationRepo = new MockAuthVerificationRepository();
  const mailService = new MockMailService();
  const passwordService = new BcryptPasswordService();

  const passHash = await passwordService.hash("VanePassword123");
  const vane = userRepo.addUser({
    username: "vanessa",
    email: "vane", // Correo inválido inicial
    passwordHash: passHash,
    fullName: "Vanessa",
  });

  userRepo.addUser({
    username: "admin",
    email: "admin@ardientes.com",
    passwordHash: passHash,
    fullName: "Admin",
  });

  const requestEmailUseCase = new RequestEmailSetupUseCase(userRepo, verificationRepo, mailService, passwordService);
  const confirmEmailUseCase = new ConfirmEmailSetupUseCase(userRepo, verificationRepo);

  // Intento de asociar un correo que ya pertenece a otro usuario (admin@ardientes.com)
  await assertRejects(
    async () => {
      await requestEmailUseCase.execute({
        userId: vane.id,
        currentPassword: "VanePassword123",
        newEmail: "admin@ardientes.com",
      });
    },
    Error,
    "ya se encuentra registrado"
  );

  // Vincular correo propio válido
  await requestEmailUseCase.execute({
    userId: vane.id,
    currentPassword: "VanePassword123",
    newEmail: "vanessa.oficial@gmail.com",
  });

  assertEquals(mailService.sentEmails.length, 1);
  const code = mailService.sentEmails[0].code;

  // Confirmar código
  const confirmResult = await confirmEmailUseCase.execute({
    userId: vane.id,
    email: "vanessa.oficial@gmail.com",
    code,
  });

  assertEquals(confirmResult.user.email, "vanessa.oficial@gmail.com");
  const updated = await userRepo.findById(vane.id);
  assertEquals(updated!.email, "vanessa.oficial@gmail.com");
});

Deno.test("Auth Suite - 9. Cambio de contraseña de usuario autenticado", async () => {
  const userRepo = new MockUserRepository();
  const passwordService = new BcryptPasswordService();
  const jwtService = new JoseJwtService("secret_test_key_minimum_32_characters_long");

  const hash = await passwordService.hash("CurrentPass123");
  const user = userRepo.addUser({
    username: "paola",
    email: "paola@ardientes.com",
    passwordHash: hash,
    fullName: "Paola",
  });

  const changeUseCase = new ChangePasswordUseCase(userRepo, passwordService, jwtService);

  // Rechazar si contraseña actual es incorrecta
  await assertRejects(
    async () => {
      await changeUseCase.execute({
        userId: user.id,
        currentPassword: "WrongPassword!",
        newPassword: "BrandNewPassword2026",
      });
    },
    Error,
    "actual ingresada es incorrecta"
  );

  // Éxito con contraseña correcta
  const res = await changeUseCase.execute({
    userId: user.id,
    currentPassword: "CurrentPass123",
    newPassword: "BrandNewPassword2026",
  });
  assert(res.message.includes("exitosamente"));
  assert(typeof res.accessToken === "string" && res.accessToken.length > 0);

  const decoded = await jwtService.verifyToken(res.accessToken);
  assertEquals(decoded.tokenVersion, 2);

  const updated = await userRepo.findById(user.id);
  const isMatch = await passwordService.compare("BrandNewPassword2026", updated!.passwordHash);
  assertEquals(isMatch, true);
  assertEquals(updated!.tokenVersion, 2);
});

Deno.test("Auth Suite - 10. JWT de recuperación (resetToken) rechazado por endpoints normales", async () => {
  // Usar el jwtService configurado en las dependencias para que coincida con authMiddleware
  const { jwtService } = await import("../modules/auth/infrastructure/dependencies.ts");

  // Generar un resetToken exclusivo (con purpose: "pwd_reset")
  const resetToken = await jwtService.generateResetToken({
    userId: 2,
    email: "fernando@ardientes.com",
    codeId: 10,
  });

  // Intentar usarlo en un endpoint protegido pasando por authMiddleware
  const mockContext: any = {
    request: {
      headers: new Headers({
        Authorization: `Bearer ${resetToken}`,
      }),
    },
    state: {},
  };

  await assertRejects(
    async () => {
      await authMiddleware(mockContext as Context, async () => {});
    },
    Error,
    "Token no autorizado"
  );
});

Deno.test("Auth Suite - 11. Invalidación de sesiones anteriores con tokenVersion", async () => {
  const userRepo = new MockUserRepository();
  const passwordService = new BcryptPasswordService();
  const jwtService = new JoseJwtService("secret_test_key_minimum_32_characters_long");

  const hash = await passwordService.hash("OldPass123");
  const user = userRepo.addUser({
    username: "fernando",
    email: "fernando@ardientes.com",
    passwordHash: hash,
    fullName: "Fernando",
    tokenVersion: 1,
  });

  // Generar token con tokenVersion = 1
  const sessionTokenV1 = await jwtService.generateToken({
    sub: String(user.id),
    username: user.username,
    fullName: user.fullName,
    roles: user.roles,
    permissions: user.permissions,
    tokenVersion: 1,
    purpose: "session",
  });

  // Simular cambio de contraseña que incrementa tokenVersion a 2
  await userRepo.updatePassword(user.id, "new_hash_string");

  // Verificar que el usuario en la BD ahora tiene tokenVersion = 2
  const refreshedUser = await userRepo.findById(user.id);
  assertEquals(refreshedUser!.tokenVersion, 2);

  // Decodificar el tokenV1 y comprobar que su tokenVersion (1) es menor que el de la BD (2)
  const payload = await jwtService.verifyToken(sessionTokenV1);
  assertEquals(payload.tokenVersion, 1);
  assert(payload.tokenVersion !== refreshedUser!.tokenVersion, "El token anterior debe diferir de la versión en BD");
});

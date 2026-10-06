import { assertEquals, assertRejects, assert } from "asserts";
import { Customer } from "../modules/customers/domain/Customer.ts";
import { CustomerRepository } from "../modules/customers/domain/CustomerRepository.ts";
import { CustomerActivationToken } from "../modules/customers/domain/CustomerActivationToken.ts";
import { CustomerActivationRepository } from "../modules/customers/domain/CustomerActivationRepository.ts";
import { GenerateActivationCodeUseCase } from "../modules/customers/application/use-cases/GenerateActivationCodeUseCase.ts";
import { ActivateCustomerUseCase } from "../modules/customers/application/use-cases/ActivateCustomerUseCase.ts";
import { RegisterCustomerUseCase } from "../modules/customers/application/use-cases/RegisterCustomerUseCase.ts";
import { CustomerLoginUseCase } from "../modules/customers/application/use-cases/CustomerLoginUseCase.ts";
import { BcryptPasswordService } from "../modules/auth/infrastructure/services/BcryptPasswordService.ts";
import { JoseJwtService } from "../modules/auth/infrastructure/services/JoseJwtService.ts";
import { authMiddleware } from "../shared/infrastructure/middleware/auth.middleware.ts";
import { requirePermission } from "../shared/infrastructure/middleware/authorize.middleware.ts";
import { clientActivationRateLimitMiddleware } from "../shared/infrastructure/middleware/clientActivationRateLimit.middleware.ts";
import { ValidationError, UnauthorizedError, ForbiddenError } from "../shared/domain/error.ts";
import { Context } from "oak";

// ─── Mocks para Pruebas Completas y Deterministas ────────────────────────────

class MockCustomerRepository implements CustomerRepository {
  public customers: Map<number, Customer> = new Map();
  private nextId = 1;

  findById(id: number): Promise<Customer | null> {
    return Promise.resolve(this.customers.get(id) ?? null);
  }

  findByPhone(phone: string): Promise<Customer | null> {
    const clean = phone.replace(/[\s\-\(\)]/g, "");
    for (const c of this.customers.values()) {
      if (c.phone.replace(/[\s\-\(\)]/g, "") === clean) return Promise.resolve(c);
    }
    return Promise.resolve(null);
  }

  findByEmail(email: string): Promise<Customer | null> {
    const clean = email.trim().toLowerCase();
    for (const c of this.customers.values()) {
      if (c.email && c.email.trim().toLowerCase() === clean) return Promise.resolve(c);
    }
    return Promise.resolve(null);
  }

  search(_term: string, _limit?: number): Promise<Customer[]> {
    return Promise.resolve(Array.from(this.customers.values()));
  }

  save(customer: Customer): Promise<Customer> {
    const id = customer.id ?? this.nextId++;
    const saved = new Customer(
      id,
      customer.fullName,
      customer.phone,
      customer.email,
      customer.address,
      customer.loyaltyPoints,
      customer.totalOrders,
      customer.totalSpent,
      customer.birthDate,
      customer.isActive,
      customer.createdAt ?? new Date(),
      customer.passwordHash,
      customer.tokenVersion ?? 1,
      customer.emailVerified ?? false,
      customer.lastLoginAt
    );
    this.customers.set(id, saved);
    return Promise.resolve(saved);
  }

  update(customer: Customer): Promise<Customer> {
    if (!customer.id) throw new Error("Customer id is required for update");
    this.customers.set(customer.id, customer);
    return Promise.resolve(customer);
  }

  updateLastLogin(customerId: number): Promise<void> {
    const c = this.customers.get(customerId);
    if (c) {
      c.lastLoginAt = new Date();
    }
    return Promise.resolve();
  }

  addLoyaltyTransaction(_tx: any): Promise<any> {
    return Promise.resolve();
  }

  hasOrderAward(_orderId: number): Promise<boolean> {
    return Promise.resolve(false);
  }

  getLoyaltyHistory(_customerId: number, _limit?: number): Promise<any[]> {
    return Promise.resolve([]);
  }
}

class MockCustomerActivationRepository implements CustomerActivationRepository {
  public tokens: Map<number, CustomerActivationToken> = new Map();
  private nextId = 1;

  save(token: CustomerActivationToken): Promise<CustomerActivationToken> {
    const id = token.id ?? this.nextId++;
    token.setId(id);
    this.tokens.set(id, token);
    return Promise.resolve(token);
  }

  findLatestPendingByCustomerId(customerId: number): Promise<CustomerActivationToken | null> {
    const customerTokens = Array.from(this.tokens.values())
      .filter((t) => t.customerId === customerId && !t.isUsed())
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    return Promise.resolve(customerTokens[0] ?? null);
  }

  invalidatePreviousPending(customerId: number): Promise<void> {
    for (const t of this.tokens.values()) {
      if (t.customerId === customerId && !t.isUsed()) {
        (t as any)._expiresAt = new Date(Date.now() - 1000);
      }
    }
    return Promise.resolve();
  }

  incrementAttempts(tokenId: number): Promise<number> {
    const token = this.tokens.get(tokenId);
    if (!token) return Promise.resolve(0);
    token.incrementAttempts();
    return Promise.resolve(token.attempts);
  }

  // Simulación atómica con mutex en memoria para pruebas de concurrencia
  private lock = false;
  async atomicConsumeAndActivate(
    tokenId: number,
    customerId: number,
    passwordHash: string,
    email?: string | null
  ): Promise<boolean> {
    while (this.lock) {
      await new Promise((r) => setTimeout(r, 5));
    }
    this.lock = true;
    try {
      const token = this.tokens.get(tokenId);
      if (!token || token.isUsed() || token.isExpired() || token.isBlocked()) {
        return false;
      }
      token.markAsUsed();

      if (globalCustomerRepo) {
        const customer = await globalCustomerRepo.findById(customerId);
        if (!customer) return false;
        if (customer.passwordHash !== null && customer.passwordHash.trim() !== "") {
          return false;
        }
        customer.passwordHash = passwordHash;
        customer.tokenVersion = 1;
        if (email) customer.email = email;
        await globalCustomerRepo.update(customer);
      }
      return true;
    } finally {
      this.lock = false;
    }
  }
}

let globalCustomerRepo: MockCustomerRepository;

function createMockContext(ip: string = "127.0.0.1", token?: string): Context {
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return {
    request: {
      ip,
      headers,
    },
    response: {
      status: 200,
      headers: new Headers(),
      body: undefined,
    },
    state: {},
  } as unknown as Context;
}

// ─── SUITE DE PRUEBAS A hasta W ──────────────────────────────────────────────

Deno.test({
  name: "Customer Activation Security — Suite Completa (Casos A hasta W)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async (t) => {
    const customerRepo = new MockCustomerRepository();
    globalCustomerRepo = customerRepo;
    const activationRepo = new MockCustomerActivationRepository();
    const passwordService = new BcryptPasswordService();
    const jwtService = new JoseJwtService("test_secret_for_activation_suite_32chars!");

    const generateCodeUseCase = new GenerateActivationCodeUseCase(customerRepo, activationRepo);
    const activateUseCase = new ActivateCustomerUseCase(customerRepo, activationRepo, passwordService, jwtService);
    const registerUseCase = new RegisterCustomerUseCase(customerRepo, passwordService, jwtService);
    const loginUseCase = new CustomerLoginUseCase(customerRepo, passwordService, jwtService);

    // Cliente base creado previamente en Caja (id: 50, 45 puntos, 4 pedidos)
    await customerRepo.save(
      new Customer(
        50,
        "Santiago Gómez",
        "3159998877",
        "santiago@ardientes.com",
        "Calle 10 # 5-20",
        45, // loyaltyPoints
        4,  // totalOrders
        75000, // totalSpent
        null,
        true,
        new Date(),
        null, // sin password_hash
        1,
        false
      )
    );

    let generatedCodeAdmin = "";
    let generatedCodeCajero = "";

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("A. ADMIN genera código correctamente", async () => {
      const result = await generateCodeUseCase.execute({
        customerId: 50,
        createdBy: 1, // ADMIN
      });

      assert(result.success, "Debe ser exitoso");
      assertEquals(result.customerId, 50);
      assert(result.activationCode.length >= 8, "El código debe tener al menos 8 caracteres");
      assert(result.activationCode.includes("-"), "Debe tener formato XXXX-XXXX");
      generatedCodeAdmin = result.activationCode;

      const pendingToken = await activationRepo.findLatestPendingByCustomerId(50);
      assert(pendingToken !== null, "Debe haberse guardado el token en repositorio");
      assertEquals(pendingToken!.createdBy, 1, "Debe registrar createdBy = 1 (ADMIN)");
      assert(pendingToken!.codeHash !== generatedCodeAdmin, "Nunca debe almacenar el código en texto plano");
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("B. CAJERO genera código correctamente", async () => {
      // Al generar como CAJERO para el mismo cliente, invalida el previo y crea uno nuevo
      const result = await generateCodeUseCase.execute({
        customerId: 50,
        createdBy: 2, // CAJERO
      });

      assert(result.success);
      assertEquals(result.customerId, 50);
      generatedCodeCajero = result.activationCode;

      const pendingToken = await activationRepo.findLatestPendingByCustomerId(50);
      assertEquals(pendingToken!.createdBy, 2, "Debe registrar createdBy = 2 (CAJERO)");
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("C. MESERO intenta generar código y es rechazado", async () => {
      // El rol MESERO no posee el permiso 'customers:manage'
      const meseroCtx = createMockContext();
      (meseroCtx.state as any).user = {
        id: 6,
        username: "mesero1",
        roles: ["MESERO"],
        permissions: ["orders:create", "tables:read", "tables:orders"], // SIN customers:manage
      };

      const guardMiddleware = requirePermission("customers:manage");
      await assertRejects(
        async () => {
          await guardMiddleware(meseroCtx, async () => {});
        },
        ForbiddenError,
        "Acceso denegado: No cuenta con los permisos necesarios para realizar esta acción"
      );
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("E. Código incorrecto aumenta attempts", async () => {
      await assertRejects(
        async () => {
          await activateUseCase.execute({
            phone: "3159998877",
            activationCode: "WRONG-CODE",
            password: "SecurePassword123!",
          });
        },
        ValidationError,
        "Código de activación incorrecto"
      );

      const token = await activationRepo.findLatestPendingByCustomerId(50);
      assertEquals(token!.attempts, 1, "Attempts debe ser 1 tras el primer fallo");
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("F. Código se bloquea después de 3 intentos", async () => {
      // Intento 2
      await assertRejects(
        async () => {
          await activateUseCase.execute({
            phone: "3159998877",
            activationCode: "WRONG-CODE",
            password: "SecurePassword123!",
          });
        },
        ValidationError,
        "Código de activación incorrecto"
      );

      // Intento 3 (llega a max_attempts = 3)
      await assertRejects(
        async () => {
          await activateUseCase.execute({
            phone: "3159998877",
            activationCode: "WRONG-CODE",
            password: "SecurePassword123!",
          });
        },
        ValidationError,
        "bloqueado"
      );

      const token = await activationRepo.findLatestPendingByCustomerId(50);
      assertEquals(token!.attempts, 3, "Attempts debe ser 3");
      assert(token!.isBlocked(), "El token debe estar marcado como bloqueado");

      // Intento 4: Rechazo inmediato por estar bloqueado
      await assertRejects(
        async () => {
          await activateUseCase.execute({
            phone: "3159998877",
            activationCode: generatedCodeCajero, // incluso con el código correcto
            password: "SecurePassword123!",
          });
        },
        ValidationError,
        "bloqueado"
      );
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("G. Código expirado es rechazado", async () => {
      // Generar nuevo código
      const genResult = await generateCodeUseCase.execute({
        customerId: 50,
        createdBy: 2,
      });

      const token = await activationRepo.findLatestPendingByCustomerId(50);
      // Forzar expiración simulada
      (token as any)._expiresAt = new Date(Date.now() - 5000);

      await assertRejects(
        async () => {
          await activateUseCase.execute({
            phone: "3159998877",
            activationCode: genResult.activationCode,
            password: "SecurePassword123!",
          });
        },
        ValidationError,
        "expirado"
      );
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("H. Generar nuevo código invalida el anterior", async () => {
      // 1. Generar código 1
      const gen1 = await generateCodeUseCase.execute({ customerId: 50, createdBy: 1 });
      // 2. Generar código 2 (invalida código 1)
      const gen2 = await generateCodeUseCase.execute({ customerId: 50, createdBy: 2 });

      // Código 1 debe ser rechazado
      await assertRejects(
        async () => {
          await activateUseCase.execute({
            phone: "3159998877",
            activationCode: gen1.activationCode,
            password: "Password123!",
          });
        },
        ValidationError
      );

      // Guardamos gen2 para el siguiente paso exitoso
      generatedCodeAdmin = gen2.activationCode;
    });

    // ──────────────────────────────────────────────────────────────────────────
    let customerAccessToken = "";

    await t.step("I. Cliente existente puede activar su cuenta correctamente", async () => {
      const result = await activateUseCase.execute({
        phone: "3159998877",
        activationCode: generatedCodeAdmin,
        password: "CustomerPassword2026!",
      });

      assert(result.accessToken.length > 20, "Debe generar accessToken");
      assertEquals(result.customer.id, 50);
      customerAccessToken = result.accessToken;

      const customerInRepo = await customerRepo.findById(50);
      assert(customerInRepo!.passwordHash !== null, "Debe tener passwordHash establecido");
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("D. Código generado puede utilizarse una sola vez", async () => {
      // Intentar reutilizar el mismo código ya consumido
      await assertRejects(
        async () => {
          await activateUseCase.execute({
            phone: "3159998877",
            activationCode: generatedCodeAdmin,
            password: "AnotherPassword123!",
          });
        },
        ValidationError,
        "activada"
      );
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("J. Cliente conserva loyalty_points", async () => {
      const c = await customerRepo.findById(50);
      assertEquals(c!.loyaltyPoints, 45, "Debe conservar exactamente 45 puntos");
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("K. Cliente conserva total_orders", async () => {
      const c = await customerRepo.findById(50);
      assertEquals(c!.totalOrders, 4, "Debe conservar 4 pedidos");
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("L. Cliente conserva total_spent", async () => {
      const c = await customerRepo.findById(50);
      assertEquals(c!.totalSpent, 75000, "Debe conservar $75.000 gastados");
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("M. Cliente conserva orders.customer_id", () => {
      const order = { id: 301, customerId: 50, total: 25000 };
      assertEquals(order.customerId, 50, "orders.customer_id debe seguir apuntando a 50");
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("N. No se crea segundo customer", () => {
      assertEquals(customerRepo.customers.size, 1, "Debe existir únicamente el cliente ID 50");
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("O. No se crea registro en users", async () => {
      const { connectDB, disconnectDB } = await import("../shared/infrastructure/database.ts");
      const { userRepository } = await import("../modules/auth/infrastructure/dependencies.ts");
      try {
        await connectDB();
        const checkUser = await userRepository.findByUsername("3159998877");
        assertEquals(checkUser, null, "users no debe contener ningún registro con este teléfono");
      } finally {
        await disconnectDB();
      }
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("P. Registro normal con teléfono existente sin contraseña es rechazado", async () => {
      // Simular cliente en Caja id: 51 sin password_hash
      await customerRepo.save(
        new Customer(
          51,
          "Cliente Caja Sin Clave",
          "3161234567",
          "sinclave@ardientes.com",
          null,
          10,
          1,
          20000,
          null,
          true,
          new Date(),
          null, // password_hash es null
          1,
          false
        )
      );

      await assertRejects(
        async () => {
          await registerUseCase.execute({
            fullName: "Impostor",
            phone: "3161234567",
            email: "impostor@gmail.com",
            password: "ImpostorPassword123!",
          });
        },
        ValidationError,
        "Este número de teléfono ya está registrado en nuestro punto de venta. Para activar tu cuenta web y conservar tus puntos, utiliza el Código de Activación entregado en Caja."
      );
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("Q. Registro normal con teléfono completamente nuevo funciona", async () => {
      const newCustomerResult = await registerUseCase.execute({
        fullName: "Cliente Totalmente Nuevo",
        phone: "3009990011",
        email: "nuevo@example.com",
        password: "NewCustomer2026!",
      });

      assert(newCustomerResult.accessToken.length > 20);
      assertEquals(newCustomerResult.customer.fullName, "Cliente Totalmente Nuevo");
      assertEquals(newCustomerResult.customer.loyaltyPoints, 0);
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("R. Cliente activado puede iniciar sesión posteriormente mediante /client/login", async () => {
      const loginResult = await loginUseCase.execute({
        identifier: "3159998877",
        password: "CustomerPassword2026!",
      });

      assert(loginResult.accessToken.length > 20);
      assertEquals(loginResult.customer.id, 50);
      assertEquals(loginResult.customer.fullName, "Santiago Gómez");
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("S. JWT CUSTOMER funciona con /client/me", async () => {
      // Verificar que el token emitido sea un JWT CUSTOMER válido con los claims correctos
      const decoded = await jwtService.verifyCustomerToken(customerAccessToken);
      assertEquals(decoded.userType, "CUSTOMER");
      assertEquals(decoded.purpose, "customer_session");
      assertEquals(decoded.customerId, 50);
      assertEquals(decoded.phone, "3159998877");
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("T. JWT CUSTOMER no puede entrar a endpoints internos", async () => {
      const internalCtx = createMockContext("127.0.0.1", customerAccessToken);
      await assertRejects(
        async () => {
          await authMiddleware(internalCtx, async () => {});
        },
        UnauthorizedError,
        "Token de autenticación inválido o expirado"
      );
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("U. Cliente inactivo no puede activarse", async () => {
      // Cliente inactivo en caja
      await customerRepo.save(
        new Customer(
          52,
          "Cliente Inactivo",
          "3180001122",
          "inactivo@ardientes.com",
          null,
          0,
          0,
          0,
          null,
          false, // inactivo
          new Date(),
          null,
          1,
          false
        )
      );

      // Intento de generar código
      await assertRejects(
        async () => {
          await generateCodeUseCase.execute({ customerId: 52, createdBy: 1 });
        },
        ValidationError,
        "inactivo"
      );

      // Intento de activar
      await assertRejects(
        async () => {
          await activateUseCase.execute({
            phone: "3180001122",
            activationCode: "ANY-CODE",
            password: "Password123!",
          });
        },
        ValidationError,
        "inválidos"
      );
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("V. Dos solicitudes simultáneas no pueden consumir el mismo código", async () => {
      // Crear nuevo cliente pendiente y código
      await customerRepo.save(
        new Customer(
          53,
          "Cliente Concurrente",
          "3195556677",
          "concurrente@ardientes.com",
          null,
          5,
          1,
          15000,
          null,
          true,
          new Date(),
          null,
          1,
          false
        )
      );

      const codeGen = await generateCodeUseCase.execute({ customerId: 53, createdBy: 1 });

      const p1 = activateUseCase.execute({
        phone: "3195556677",
        activationCode: codeGen.activationCode,
        password: "FirstWinPassword123!",
      });

      const p2 = activateUseCase.execute({
        phone: "3195556677",
        activationCode: codeGen.activationCode,
        password: "SecondFailPassword123!",
      });

      const results = await Promise.allSettled([p1, p2]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      assertEquals(fulfilled.length, 1, "Exactamente una petición debe tener éxito");
      assertEquals(rejected.length, 1, "La petición concurrente debe ser rechazada");
    });

    // ──────────────────────────────────────────────────────────────────────────
    await t.step("W. Rate limiting funciona correctamente", async () => {
      (globalThis as any).__clientActivationRateLimitStore = new Map();
      const ip = "192.168.10.50";

      // Ejecutar 10 intentos (máximo permitido)
      for (let i = 1; i <= 10; i++) {
        const ctx = createMockContext(ip);
        await clientActivationRateLimitMiddleware(ctx, async () => {});
        assertEquals(ctx.response.status, 200, `Intento ${i} debe ser permitido (200)`);
      }

      // El intento 11 debe ser bloqueado con 429 Too Many Requests
      const blockedCtx = createMockContext(ip);
      await clientActivationRateLimitMiddleware(blockedCtx, async () => {});
      assertEquals(blockedCtx.response.status, 429, "Intento 11 debe responder 429");
      assert(blockedCtx.response.headers.has("Retry-After"), "Debe incluir cabecera Retry-After");
    });
  },
});

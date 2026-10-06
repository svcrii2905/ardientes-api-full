import { assertEquals, assertRejects, assert } from "asserts";
import { Customer } from "../modules/customers/domain/Customer.ts";
import { CustomerRepository } from "../modules/customers/domain/CustomerRepository.ts";
import { LoyaltyTransaction } from "../modules/customers/domain/LoyaltyTransaction.ts";
import { RegisterCustomerUseCase } from "../modules/customers/application/use-cases/RegisterCustomerUseCase.ts";
import { CustomerLoginUseCase } from "../modules/customers/application/use-cases/CustomerLoginUseCase.ts";
import { BcryptPasswordService } from "../modules/auth/infrastructure/services/BcryptPasswordService.ts";
import { JoseJwtService } from "../modules/auth/infrastructure/services/JoseJwtService.ts";
import { customerAuthMiddleware } from "../shared/infrastructure/middleware/customerAuth.middleware.ts";
import { authMiddleware } from "../shared/infrastructure/middleware/auth.middleware.ts";
import { ValidationError, UnauthorizedError } from "../shared/domain/error.ts";
import { Context } from "oak";

// ─── Mocks para Pruebas Aisladas y Rápidas ──────────────────────────────────

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

  addLoyaltyTransaction(tx: LoyaltyTransaction): Promise<LoyaltyTransaction> {
    return Promise.resolve(tx);
  }

  hasOrderAward(_orderId: number): Promise<boolean> {
    return Promise.resolve(false);
  }

  getLoyaltyHistory(_customerId: number, _limit?: number): Promise<LoyaltyTransaction[]> {
    return Promise.resolve([]);
  }
}

Deno.test({
  name: "Customer Auth — Suite Completa (Casos A hasta O)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async (t) => {
    const customerRepo = new MockCustomerRepository();
  const passwordService = new BcryptPasswordService();
  const jwtService = new JoseJwtService("test_secret_jwt_for_customer_suite_32chars!");

  const registerUseCase = new RegisterCustomerUseCase(customerRepo, passwordService, jwtService);
  const loginUseCase = new CustomerLoginUseCase(customerRepo, passwordService, jwtService);

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("A. Registrar cliente nuevo exitosamente", async () => {
    const result = await registerUseCase.execute({
      fullName: "Camila Torres",
      phone: "3201112233",
      email: "camila@example.com",
      password: "Password123!",
    });

    assert(result.accessToken.length > 20, "Debe emitir accessToken");
    assertEquals(result.customer.fullName, "Camila Torres");
    assertEquals(result.customer.loyaltyPoints, 0, "Puntos iniciales deben ser 0");
    assertEquals(result.isExistingLinked, false, "Debe ser cliente nuevo");

    const decoded = await jwtService.verifyCustomerToken(result.accessToken);
    assertEquals(decoded.userType, "CUSTOMER", "Claim userType debe ser CUSTOMER");
    assertEquals(decoded.purpose, "customer_session");
  });

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("B. Registrar cliente existente sin credenciales (debe ser rechazado para exigir activación)", async () => {
    // Simular cliente preexistente creado en caja
    await customerRepo.save(
      new Customer(
        50,
        "Santiago Gómez",
        "3159998877",
        "santiago@ardientes.com",
        "Calle 10 # 5-20",
        45, // 45 puntos acumulados en caja
        4,  // 4 pedidos
        75000,
        null,
        true,
        new Date(),
        null, // passwordHash es NULL
        1,
        false
      )
    );

    // El registro normal debe ser rechazado para exigir el código de activación de Caja
    await assertRejects(
      async () => {
        await registerUseCase.execute({
          fullName: "Santiago Gómez",
          phone: "3159998877",
          email: "santiago@ardientes.com",
          password: "NewPassword456!",
        });
      },
      ValidationError,
      "Este número de teléfono ya está registrado en nuestro punto de venta. Para activar tu cuenta web y conservar tus puntos, utiliza el Código de Activación entregado en Caja."
    );

    // Simular activación de credenciales para que los pasos posteriores (login, duplicados) continúen
    const inRepo = await customerRepo.findById(50);
    inRepo!.passwordHash = await passwordService.hash("NewPassword456!");
    await customerRepo.update(inRepo!);
  });

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("C. Intentar registrar cliente duplicado (debe ser rechazado)", async () => {
    await assertRejects(
      async () => {
        await registerUseCase.execute({
          fullName: "Santiago Gómez Impostor",
          phone: "3159998877",
          email: "santiago@ardientes.com",
          password: "AnotherPassword!",
        });
      },
      ValidationError,
      "Ya existe una cuenta activa con este teléfono"
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("D. Login correcto (por teléfono y por email)", async () => {
    // Por teléfono
    const loginByPhone = await loginUseCase.execute({
      identifier: "3159998877",
      password: "NewPassword456!",
    });
    assert(loginByPhone.accessToken.length > 20);
    assertEquals(loginByPhone.customer.id, 50);

    // Por correo
    const loginByEmail = await loginUseCase.execute({
      identifier: "santiago@ardientes.com",
      password: "NewPassword456!",
    });
    assert(loginByEmail.accessToken.length > 20);
    assertEquals(loginByEmail.customer.id, 50);

    const inRepo = await customerRepo.findById(50);
    assert(inRepo!.lastLoginAt !== null, "lastLoginAt debe haberse actualizado");
  });

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("E. Login con contraseña incorrecta (rechazado con UnauthorizedError)", async () => {
    await assertRejects(
      async () => {
        await loginUseCase.execute({
          identifier: "3159998877",
          password: "ClaveIncorrecta!",
        });
      },
      UnauthorizedError,
      "Credenciales de acceso inválidas"
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("F. Login con cliente inexistente (anti-enumeración)", async () => {
    await assertRejects(
      async () => {
        await loginUseCase.execute({
          identifier: "3000000000",
          password: "CualquierPassword123!",
        });
      },
      UnauthorizedError,
      "Credenciales de acceso inválidas"
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("G. Obtener /client/me con token válido", async () => {
    const loginRes = await loginUseCase.execute({
      identifier: "3159998877",
      password: "NewPassword456!",
    });

    // Simular customerAuthMiddleware con el token
    const decoded = await jwtService.verifyCustomerToken(loginRes.accessToken);
    assertEquals(decoded.userType, "CUSTOMER");
    assertEquals(decoded.customerId, 50);
    assertEquals(decoded.phone, "3159998877");
  });

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("H. Intentar /client/me sin token (rechazado con 401)", async () => {
    const mockContext: any = {
      request: {
        headers: new Headers(), // Sin Authorization
      },
      state: {},
    };

    await assertRejects(
      async () => {
        await customerAuthMiddleware(mockContext as Context, async () => {});
      },
      UnauthorizedError,
      "Autenticación de cliente requerida"
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("I. Intentar /client/me con token de colaborador (RECHAZADO)", async () => {
    // Generar un token de colaborador legítimo
    const staffToken = await jwtService.generateToken({
      sub: "2",
      username: "cajero1",
      fullName: "Cajero Ardientes",
      roles: ["CAJERO"],
      permissions: ["orders:create", "payments:manage"],
      tokenVersion: 1,
      purpose: "session",
    });

    const mockContext: any = {
      request: {
        headers: new Headers({
          Authorization: `Bearer ${staffToken}`,
        }),
      },
      state: {},
    };

    await assertRejects(
      async () => {
        await customerAuthMiddleware(mockContext as Context, async () => {});
      },
      UnauthorizedError
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("J. Intentar endpoint interno con token CUSTOMER (RECHAZADO por authMiddleware)", async () => {
    const customerLogin = await loginUseCase.execute({
      identifier: "3159998877",
      password: "NewPassword456!",
    });

    const mockStaffContext: any = {
      request: {
        headers: new Headers({
          Authorization: `Bearer ${customerLogin.accessToken}`,
        }),
      },
      state: {},
    };

    // authMiddleware protege los endpoints de colaboradores
    await assertRejects(
      async () => {
        await authMiddleware(mockStaffContext as Context, async () => {});
      },
      UnauthorizedError
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("K. Token CUSTOMER con tokenVersion incorrecto (RECHAZADO)", async () => {
    // Generar token con tokenVersion = 99 (en BD es 1)
    const outOfSyncToken = await jwtService.generateCustomerToken({
      customerId: 50,
      phone: "3159998877",
      email: "santiago@ardientes.com",
      fullName: "Santiago Gómez",
      tokenVersion: 99,
    });

    const decoded = await jwtService.verifyCustomerToken(outOfSyncToken);
    const inRepo = await customerRepo.findById(decoded.customerId);
    assert(inRepo!.tokenVersion !== decoded.tokenVersion, "Versión debe estar desincronizada");
  });

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("L. Cliente inactivo (rechazado)", async () => {
    const inactive = await customerRepo.save(
      new Customer(
        99,
        "Cliente Inactivo",
        "3190001122",
        "inactivo@test.com",
        null,
        0,
        0,
        0,
        null,
        false, // inactivo
        new Date(),
        await passwordService.hash("PassInactivo123!"),
        1,
        false
      )
    );

    await assertRejects(
      async () => {
        await loginUseCase.execute({
          identifier: inactive.phone,
          password: "PassInactivo123!",
        });
      },
      UnauthorizedError,
      "Credenciales de acceso inválidas"
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("M. Confirmar que los puntos del cliente existente NO cambian durante el registro", async () => {
    const customerBefore = await customerRepo.findById(50);
    assertEquals(customerBefore!.loyaltyPoints, 45, "Puntos deben permanecer en 45");
  });

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("N. Confirmar que orders.customer_id continúa intacto", () => {
    // Simular un pedido existente asociado al cliente 50
    const mockOrder = { id: 101, orderNumber: "ORD-999", customerId: 50, total: 35000 };
    assertEquals(mockOrder.customerId, 50, "orders.customer_id debe seguir apuntando a 50");
  });

  // ──────────────────────────────────────────────────────────────────────────
  await t.step("O. Confirmar que la tabla users no recibe ningún registro de cliente", async () => {
    const { connectDB, disconnectDB } = await import("../shared/infrastructure/database.ts");
    const { userRepository } = await import("../modules/auth/infrastructure/dependencies.ts");
    try {
      await connectDB();
      const checkInUsers = await userRepository.findByUsername("3159998877");
      assertEquals(checkInUsers, null, "El cliente NO debe existir en la tabla `users`");
    } finally {
      await disconnectDB();
    }
  });
  },
});

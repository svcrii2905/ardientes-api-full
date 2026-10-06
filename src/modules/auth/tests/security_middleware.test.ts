import { authMiddleware } from "../../../shared/infrastructure/middleware/auth.middleware.ts";
import { requirePermission, requireRole } from "../../../shared/infrastructure/middleware/authorize.middleware.ts";
import { JoseJwtService } from "../infrastructure/services/JoseJwtService.ts";
import { OrderController } from "../../orders/infrastructure/http/OrderController.ts";
import { PaymentController } from "../../payments/infrastructure/http/PaymentController.ts";
import { CashRegisterController } from "../../cash_register/infrastructure/http/CashRegisterController.ts";
import { TableController } from "../../tables/infrastructure/http/TableController.ts";
import { UnauthorizedError, ForbiddenError } from "../../../shared/domain/error.ts";
import { SignJWT } from "jose";
import { config } from "../../../config/env.ts";

async function runSecurityTests() {
  console.log("==================================================================");
  console.log("🛡️ INICIANDO PRUEBAS DE SEGURIDAD, MIDDLEWARES Y AUDITORÍA (FASE 3)");
  console.log("==================================================================\n");

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

  const jwtService = new JoseJwtService();
  const secretBytes = new TextEncoder().encode(config.jwt.secret);

  // Helper para simular Context de Oak
  function createMockContext(authHeader?: string, state: Record<string, unknown> = {}, bodyValue: any = {}) {
    const headers = new Map<string, string>();
    if (authHeader) headers.set("Authorization", authHeader);

    return {
      request: {
        headers: {
          get: (key: string) => headers.get(key) ?? null,
        },
        hasBody: true,
        body: () => ({ value: Promise.resolve(bodyValue) }),
        url: new URL("http://localhost:8000/api/v1/test"),
      },
      response: {
        status: 200,
        body: null as any,
      },
      state: { ...state },
      params: { id: "1" },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CASO 1: USUARIO AUTENTICADO CON PERMISO -> PERMITIDO (next llamado)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("📌 CASO 1: Usuario autenticado con permiso requerido:");
  const ctx1 = createMockContext(undefined, {
    user: {
      id: 2,
      username: "vanessa",
      fullName: "Vanessa Operaciones",
      roles: ["MESERO", "COCINA", "CAJERO"],
      permissions: ["orders:create", "orders:update_status", "payments:manage"],
    },
  });

  let nextCalled1 = false;
  const permMiddleware1 = requirePermission("orders:create");
  await permMiddleware1(ctx1 as any, () => {
    nextCalled1 = true;
    return Promise.resolve();
  });
  assert(nextCalled1, "requirePermission permite ejecución al usuario con permiso");

  // ──────────────────────────────────────────────────────────────────────────
  // CASO 2: USUARIO AUTENTICADO SIN PERMISO -> HTTP 403 ForbiddenError
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 CASO 2: Usuario autenticado sin el permiso requerido:");
  const ctx2 = createMockContext(undefined, {
    user: {
      id: 2,
      username: "vanessa",
      fullName: "Vanessa Operaciones",
      roles: ["MESERO", "COCINA", "CAJERO"],
      permissions: ["orders:create", "orders:update_status", "payments:manage"],
    },
  });

  let threw403 = false;
  try {
    const permMiddleware2 = requirePermission("config:write");
    await permMiddleware2(ctx2 as any, () => Promise.resolve());
  } catch (err) {
    if (err instanceof ForbiddenError && err.statusCode === 403) {
      threw403 = true;
    }
  }
  assert(threw403, "requirePermission lanza ForbiddenError (HTTP 403) cuando falta el permiso");

  // ──────────────────────────────────────────────────────────────────────────
  // CASO 3: SIN TOKEN DE AUTENTICACIÓN -> HTTP 401 UnauthorizedError
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 CASO 3: Petición sin token:");
  const ctx3 = createMockContext(undefined);
  let threw401NoToken = false;
  try {
    await authMiddleware(ctx3 as any, () => Promise.resolve());
  } catch (err) {
    if (err instanceof UnauthorizedError && err.statusCode === 401) {
      threw401NoToken = true;
    }
  }
  assert(threw401NoToken, "authMiddleware lanza UnauthorizedError (HTTP 401) si no hay Authorization header");

  // ──────────────────────────────────────────────────────────────────────────
  // CASO 4: TOKEN MANIPULADO O FIRMA INVÁLIDA -> HTTP 401 UnauthorizedError
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 CASO 4: Token manipulado / firma inválida:");
  const validToken = await jwtService.generateToken({
    sub: "2",
    username: "vanessa",
    fullName: "Vanessa Operaciones",
    roles: ["MESERO"],
    permissions: ["orders:create"],
  });
  // Manipulamos el token alterando un carácter de la firma
  const tamperedToken = validToken.substring(0, validToken.length - 5) + "XXXXX";
  const ctx4 = createMockContext(`Bearer ${tamperedToken}`);

  let threw401Tampered = false;
  try {
    await authMiddleware(ctx4 as any, () => Promise.resolve());
  } catch (err) {
    if (err instanceof UnauthorizedError && err.statusCode === 401) {
      threw401Tampered = true;
    }
  }
  assert(threw401Tampered, "authMiddleware rechaza token manipulado con HTTP 401");

  // ──────────────────────────────────────────────────────────────────────────
  // CASO 5: TOKEN EXPIRADO -> HTTP 401 UnauthorizedError
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 CASO 5: Token expirado:");
  const expiredToken = await new SignJWT({
    username: "vanessa",
    fullName: "Vanessa Operaciones",
    roles: ["MESERO"],
    permissions: ["orders:create"],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("2")
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200) // Hace 2 horas
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // Expiró hace 1 hora
    .sign(secretBytes);

  const ctx5 = createMockContext(`Bearer ${expiredToken}`);
  let threw401Expired = false;
  try {
    await authMiddleware(ctx5 as any, () => Promise.resolve());
  } catch (err) {
    if (err instanceof UnauthorizedError && err.statusCode === 401) {
      threw401Expired = true;
    }
  }
  assert(threw401Expired, "authMiddleware rechaza token expirado con HTTP 401");

  // ──────────────────────────────────────────────────────────────────────────
  // CASO 6 (CRÍTICO): SUPLANTACIÓN DE userId EN BODY (Creación de Pedido)
  // El cliente envía body.userId = 1 (o 999), pero el JWT pertenece al usuario 2.
  // El backend DEBE registrar user_id = 2.
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 CASO 6 (CRÍTICO): Intento de suplantación de userId en creación de pedidos:");
  let capturedCreateUserId: number | null = null;
  const mockCreateOrderUseCase = {
    execute: (dto: any) => {
      capturedCreateUserId = dto.userId;
      return Promise.resolve({
        id: 100,
        orderNumber: "PED-100",
        orderType: { value: "MESA" },
        status: { value: "PENDIENTE" },
      });
    },
  } as any;

  const orderController = new OrderController(
    mockCreateOrderUseCase,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );

  const ctx6 = createMockContext(undefined, {
    user: { id: 2, username: "vanessa", fullName: "Vanessa", roles: ["MESERO"], permissions: ["orders:create"] },
  }, {
    userId: 999, // INTENTO DE SUPLANTACIÓN EN EL BODY
    orderType: "MESA",
    tableId: 1,
    items: [],
  });

  await orderController.create(ctx6 as any);
  assert(capturedCreateUserId === 2, `Auditoría segura: Pedido creado con userId = 2 (del JWT), ignorando el 999 del body`);

  // ──────────────────────────────────────────────────────────────────────────
  // CASO 7: SUPLANTACIÓN DE performedBy / changedBy / cancelledBy
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 CASO 7: Intento de suplantación en cambio de estado, cancelaciones y pagos:");
  
  // 7a. Cambio de estado
  let capturedChangedBy: number | null = null;
  const mockChangeStatusUseCase = {
    execute: (dto: any) => {
      capturedChangedBy = dto.changedBy;
      return Promise.resolve({
        id: 100,
        status: { value: dto.newStatus },
      });
    },
  } as any;

  const orderController7 = new OrderController(
    {} as any,
    {} as any,
    {} as any,
    mockChangeStatusUseCase,
    {} as any,
    {} as any
  );

  const ctx7a = createMockContext(undefined, {
    user: { id: 3, username: "paola", fullName: "Paola", roles: ["COCINA"], permissions: ["orders:update_status"] },
  }, {
    changedBy: 1, // INTENTO DE SUPLANTACIÓN
    newStatus: "EN_PREPARACION",
  });

  await orderController7.changeStatus(ctx7a as any);
  assert(capturedChangedBy === 3, `Auditoría segura: Cambio de estado registrado con changedBy = 3 (JWT), ignorando 1 del body`);

  // 7b. Pagos (performedBy)
  let capturedPerformedByPayment: number | null = null;
  const mockProcessPaymentUseCase = {
    execute: (dto: any) => {
      capturedPerformedByPayment = dto.performedBy;
      return Promise.resolve({ id: 50, amount: 25000 });
    },
  } as any;

  const paymentController = new PaymentController(
    {} as any,
    mockProcessPaymentUseCase,
    {} as any,
    {} as any
  );

  const ctx7b = createMockContext(undefined, {
    user: { id: 4, username: "yeni", fullName: "Yeni", roles: ["CAJERO"], permissions: ["payments:manage"] },
  }, {
    performedBy: 1, // INTENTO DE SUPLANTACIÓN
    amount: 25000,
    orderId: 100,
    paymentMethodId: 1,
  });

  await paymentController.processPayment(ctx7b as any);
  assert(capturedPerformedByPayment === 4, `Auditoría segura: Pago registrado con performedBy = 4 (JWT), ignorando 1 del body`);

  // 7c. Caja (openSession, createTransaction)
  let capturedCashUserId: number | null = null;
  const mockOpenSessionUseCase = {
    execute: (dto: any) => {
      capturedCashUserId = dto.userId;
      return Promise.resolve({ id: 10, userId: dto.userId, initialCash: 50000 });
    },
  } as any;

  const cashRegisterController = new CashRegisterController(
    mockOpenSessionUseCase,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );

  const ctx7c = createMockContext(undefined, {
    user: { id: 5, username: "cajero1", fullName: "Cajero Auditado", roles: ["CAJERO"], permissions: ["cash_session:open"] },
  }, {
    userId: 999, // INTENTO DE SUPLANTACIÓN
    initialCash: 50000,
  });

  await cashRegisterController.openSession(ctx7c as any);
  assert(capturedCashUserId === 5, `Auditoría segura: Apertura de caja registrada con userId = 5 (JWT), ignorando 999 del body`);

  // 7d. Mesas (createTableOrder)
  let capturedTableUserId: number | null = null;
  const mockCreateTableOrderUseCase = {
    execute: (dto: any) => {
      capturedTableUserId = dto.userId;
      return Promise.resolve({ orderId: 200, tableId: 1, orderNumber: "ORD-200" });
    },
  } as any;

  const tableController = new TableController(
    {} as any,
    {} as any,
    {} as any,
    mockCreateTableOrderUseCase,
    {} as any,
    {} as any,
    {} as any
  );

  const ctx7d = createMockContext(undefined, {
    user: { id: 6, username: "mesero1", fullName: "Mesero Auditado", roles: ["MESERO"], permissions: ["tables:orders"] },
  }, {
    userId: 888, // INTENTO DE SUPLANTACIÓN
    tableId: 1,
    items: [],
  });

  await tableController.createTableOrder(ctx7d as any);
  assert(capturedTableUserId === 6, `Auditoría segura: Pedido en mesa registrado con userId = 6 (JWT), ignorando 888 del body`);

  // ──────────────────────────────────────────────────────────────────────────
  // CASO 8: MULTI-ROL (Vanessa/Paola/Yeni: MESERO + COCINA + CAJERO)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 CASO 8: Acceso Multi-Rol (unión de permisos de MESERO + COCINA + CAJERO):");
  const multiRoleUser = {
    id: 2,
    username: "vanessa",
    fullName: "Vanessa Polifuncional",
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
  };

  const ctx8 = createMockContext(undefined, { user: multiRoleUser });

  let canTakeTableOrders = false;
  await requirePermission("tables:orders")(ctx8 as any, () => {
    canTakeTableOrders = true;
    return Promise.resolve();
  });
  assert(canTakeTableOrders, "Multi-rol: Puede tomar pedidos de mesas (rol MESERO)");

  let canOperateKDS = false;
  await requirePermission("orders:update_status")(ctx8 as any, () => {
    canOperateKDS = true;
    return Promise.resolve();
  });
  assert(canOperateKDS, "Multi-rol: Puede avanzar pedidos en cocina (rol COCINA)");

  let canProcessPayments = false;
  await requirePermission("payments:manage")(ctx8 as any, () => {
    canProcessPayments = true;
    return Promise.resolve();
  });
  assert(canProcessPayments, "Multi-rol: Puede cobrar y procesar pagos (rol CAJERO)");

  let canOpenCashSession = false;
  await requirePermission("cash_session:open")(ctx8 as any, () => {
    canOpenCashSession = true;
    return Promise.resolve();
  });
  assert(canOpenCashSession, "Multi-rol: Puede abrir turno de caja (rol CAJERO)");

  let blockedAdminAction = false;
  try {
    await requirePermission("config:write")(ctx8 as any, () => Promise.resolve());
  } catch (err) {
    if (err instanceof ForbiddenError) blockedAdminAction = true;
  }
  assert(blockedAdminAction, "Multi-rol: NO tiene acceso a configuración administrativa (HTTP 403)");

  // ──────────────────────────────────────────────────────────────────────────
  // CASO 9: requireRole
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 CASO 9: Middleware requireRole:");
  let roleMeseroAllowed = false;
  await requireRole("MESERO", "ADMIN")(ctx8 as any, () => {
    roleMeseroAllowed = true;
    return Promise.resolve();
  });
  assert(roleMeseroAllowed, "requireRole permite acceso si el usuario tiene al menos uno de los roles autorizados");

  let roleAdminDenied = false;
  try {
    await requireRole("ADMIN")(ctx8 as any, () => Promise.resolve());
  } catch (err) {
    if (err instanceof ForbiddenError) roleAdminDenied = true;
  }
  assert(roleAdminDenied, "requireRole lanza HTTP 403 si el usuario no tiene el rol requerido (usuario sin rol ADMIN)");

  console.log("\n==================================================================");
  console.log(`📊 RESULTADOS DE SEGURIDAD: ${passed} PASADAS | ${failed} FALLIDAS`);
  console.log("==================================================================");

  if (failed > 0) {
    Deno.exit(1);
  }
}

if (import.meta.main) {
  runSecurityTests();
}

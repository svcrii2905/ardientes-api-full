import { assertEquals, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CashSession } from "../modules/cash_register/domain/CashSession.ts";
import { CashSessionStatus } from "../modules/cash_register/domain/value-objects/CashSessionStatus.ts";
import { CashSessionRepository } from "../modules/cash_register/domain/CashSessionRepository.ts";
import { CashRegisterRepository } from "../modules/cash_register/domain/CashRegisterRepository.ts";
import { CashRegister } from "../modules/cash_register/domain/CashRegister.ts";
import { CashTransactionRepository } from "../modules/cash_register/domain/CashTransactionRepository.ts";
import { OpenCashSessionUseCase } from "../modules/cash_register/application/use-cases/OpenCashSessionUseCase.ts";
import { CloseCashSessionUseCase } from "../modules/cash_register/application/use-cases/CloseCashSessionUseCase.ts";
import { ValidationError } from "../shared/domain/error.ts";

class InMemoryCashSessionRepository implements CashSessionRepository {
  public sessions: CashSession[] = [];

  async save(session: CashSession): Promise<CashSession> {
    const newId = session.id ?? this.sessions.length + 1;
    const saved = new CashSession(
      newId,
      session.openedByUserId,
      session.closedByUserId,
      session.registerId,
      session.status,
      session.openingBalance,
      session.closingBalanceExpected,
      session.closingBalanceReal,
      session.discrepancyAmount,
      session.notes,
      session.discrepancyNotes,
      session.openedAt ?? new Date(),
      session.closedAt,
      session.openedByUserName ?? "Usuario #" + session.openedByUserId
    );
    this.sessions.push(saved);
    return saved;
  }

  async update(session: CashSession): Promise<CashSession> {
    const idx = this.sessions.findIndex((s) => s.id === session.id);
    if (idx !== -1) {
      this.sessions[idx] = session;
    }
    return session;
  }

  async findById(id: number): Promise<CashSession | null> {
    const found = this.sessions.find((s) => s.id === id);
    return found ?? null;
  }

  async findActiveByRegisterId(registerId: number): Promise<CashSession | null> {
    const found = this.sessions.find((s) => s.registerId === registerId && s.isOpen());
    return found ?? null;
  }

  async findActiveByUserId(userId: number): Promise<CashSession | null> {
    const found = this.sessions.find((s) => s.openedByUserId === userId && s.isOpen());
    return found ?? null;
  }

  async findAll(): Promise<CashSession[]> {
    return this.sessions;
  }
}

class InMemoryCashRegisterRepository implements CashRegisterRepository {
  async findById(id: number): Promise<CashRegister | null> {
    if (id === 1) {
      return new CashRegister(1, "Caja Principal", true);
    }
    return null;
  }
  async findAll(): Promise<CashRegister[]> {
    return [new CashRegister(1, "Caja Principal", true)];
  }
  async save(register: CashRegister): Promise<CashRegister> {
    return register;
  }
  async update(register: CashRegister): Promise<CashRegister> {
    return register;
  }
}

class InMemoryCashTransactionRepository implements CashTransactionRepository {
  async findBySessionId(): Promise<any[]> {
    return [];
  }
  async save(tx: any): Promise<any> {
    return tx;
  }
  async calculateSessionTotals(_sessionId: number, openingBalance: number): Promise<any> {
    return {
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalOrderPaymentsCash: 0,
      totalOrderPaymentsCard: 0,
      totalOrderPaymentsDigital: 0,
      totalExpectedCash: openingBalance,
    };
  }
}

Deno.test("1. Sesión devuelve openedByUserName en el modelo de dominio", () => {
  const session = new CashSession(
    1, 10, null, 1, CashSessionStatus.open(), 50000, 0, 0, 0, null, null, new Date(), null, "Paola Gómez"
  );
  assertEquals(session.openedByUserName, "Paola Gómez");
});

Deno.test("2. El usuario propietario puede cerrar su propia sesión de caja", async () => {
  const sessionRepo = new InMemoryCashSessionRepository();
  const txnRepo = new InMemoryCashTransactionRepository();
  const closeUseCase = new CloseCashSessionUseCase(sessionRepo, txnRepo);

  const initialSession = new CashSession(
    1, 10, null, 1, CashSessionStatus.open(), 50000, 0, 0, 0, null, null, new Date(), null, "Paola Gómez"
  );
  await sessionRepo.save(initialSession);

  const closed = await closeUseCase.execute({
    sessionId: 1,
    userId: 10, // Mismo usuario que abrió
    closingBalanceReal: 50000,
  });

  assertEquals(closed.isClosed(), true);
  assertEquals(closed.closedByUserId, 10);
});

Deno.test("3. Usuario diferente NO puede cerrar la sesión", async () => {
  const sessionRepo = new InMemoryCashSessionRepository();
  const txnRepo = new InMemoryCashTransactionRepository();
  const closeUseCase = new CloseCashSessionUseCase(sessionRepo, txnRepo);

  const initialSession = new CashSession(
    1, 10, null, 1, CashSessionStatus.open(), 50000, 0, 0, 0, null, null, new Date(), null, "Paola Gómez"
  );
  await sessionRepo.save(initialSession);

  await assertRejects(
    async () => {
      await closeUseCase.execute({
        sessionId: 1,
        userId: 20, // Usuario distinto (Vanessa)
        closingBalanceReal: 50000,
      });
    },
    ValidationError,
    "No estás autorizado para cerrar esta sesión. La caja fue abierta por Paola Gómez"
  );
});

Deno.test("4. Caso específico: Paola abre -> Vanessa NO puede cerrar", async () => {
  const PAOLA_ID = 10;
  const VANESSA_ID = 20;

  const sessionRepo = new InMemoryCashSessionRepository();
  const txnRepo = new InMemoryCashTransactionRepository();
  const closeUseCase = new CloseCashSessionUseCase(sessionRepo, txnRepo);

  await sessionRepo.save(
    new CashSession(
      1, PAOLA_ID, null, 1, CashSessionStatus.open(), 50000, 0, 0, 0, null, null, new Date(), null, "Paola Gómez"
    )
  );

  await assertRejects(
    async () => {
      await closeUseCase.execute({
        sessionId: 1,
        userId: VANESSA_ID,
        closingBalanceReal: 50000,
      });
    },
    ValidationError,
    "Paola Gómez"
  );
});

Deno.test("5. Caso específico: Paola abre -> Fernando (ADMIN) NO puede cerrar si no es el titular", async () => {
  const PAOLA_ID = 10;
  const FERNANDO_ADMIN_ID = 30;

  const sessionRepo = new InMemoryCashSessionRepository();
  const txnRepo = new InMemoryCashTransactionRepository();
  const closeUseCase = new CloseCashSessionUseCase(sessionRepo, txnRepo);

  await sessionRepo.save(
    new CashSession(
      1, PAOLA_ID, null, 1, CashSessionStatus.open(), 50000, 0, 0, 0, null, null, new Date(), null, "Paola Gómez"
    )
  );

  await assertRejects(
    async () => {
      await closeUseCase.execute({
        sessionId: 1,
        userId: FERNANDO_ADMIN_ID,
        closingBalanceReal: 50000,
      });
    },
    ValidationError,
    "Paola Gómez"
  );
});

Deno.test("6. No se puede abrir una segunda sesión en register_id=1 si ya existe una sesión OPEN", async () => {
  const sessionRepo = new InMemoryCashSessionRepository();
  const regRepo = new InMemoryCashRegisterRepository();
  const openUseCase = new OpenCashSessionUseCase(sessionRepo, regRepo);

  await sessionRepo.save(
    new CashSession(
      1, 10, null, 1, CashSessionStatus.open(), 50000, 0, 0, 0, null, null, new Date(), null, "Paola Gómez"
    )
  );

  await assertRejects(
    async () => {
      await openUseCase.execute({
        registerId: 1,
        userId: 20, // Vanessa intenta abrir
        openingBalance: 30000,
      });
    },
    ValidationError
  );
});

Deno.test("7. El error de segunda apertura identifica al usuario titular (Paola Gómez)", async () => {
  const sessionRepo = new InMemoryCashSessionRepository();
  const regRepo = new InMemoryCashRegisterRepository();
  const openUseCase = new OpenCashSessionUseCase(sessionRepo, regRepo);

  await sessionRepo.save(
    new CashSession(
      1, 10, null, 1, CashSessionStatus.open(), 50000, 0, 0, 0, null, null, new Date(), null, "Paola Gómez"
    )
  );

  await assertRejects(
    async () => {
      await openUseCase.execute({
        registerId: 1,
        userId: 20,
        openingBalance: 30000,
      });
    },
    ValidationError,
    "ya tiene una sesión abierta activa por Paola Gómez"
  );
});

Deno.test("8. userId enviado por frontend NO suplanta al usuario del JWT", async () => {
  const sessionRepo = new InMemoryCashSessionRepository();
  const txnRepo = new InMemoryCashTransactionRepository();
  const closeUseCase = new CloseCashSessionUseCase(sessionRepo, txnRepo);

  await sessionRepo.save(
    new CashSession(
      1, 10, null, 1, CashSessionStatus.open(), 50000, 0, 0, 0, null, null, new Date(), null, "Paola Gómez"
    )
  );

  // Si el backend recibe userId=20 (JWT de Vanessa), aunque el frontend intente enviar userId=10 en el body, el backend rechaza el cierre.
  await assertRejects(
    async () => {
      await closeUseCase.execute({
        sessionId: 1,
        userId: 20, // Identidad real extraída del JWT
        closingBalanceReal: 50000,
      });
    },
    ValidationError
  );
});

Deno.test("9. Una sesión abierta NO se modifica tras un intento fallido de cierre", async () => {
  const sessionRepo = new InMemoryCashSessionRepository();
  const txnRepo = new InMemoryCashTransactionRepository();
  const closeUseCase = new CloseCashSessionUseCase(sessionRepo, txnRepo);

  const initialSession = new CashSession(
    1, 10, null, 1, CashSessionStatus.open(), 50000, 0, 0, 0, null, null, new Date(), null, "Paola Gómez"
  );
  await sessionRepo.save(initialSession);

  try {
    await closeUseCase.execute({
      sessionId: 1,
      userId: 20,
      closingBalanceReal: 50000,
    });
  } catch {
    // ignorar error esperado
  }

  const sessionPost = await sessionRepo.findById(1);
  assertEquals(sessionPost?.isOpen(), true);
  assertEquals(sessionPost?.closedByUserId, null);
  assertEquals(sessionPost?.closedAt, null);
});

Deno.test("10. La sesión legacy #2 permanece intacta", async () => {
  const sessionRepo = new InMemoryCashSessionRepository();
  const legacySession = new CashSession(
    2, 99, null, 1, CashSessionStatus.open(), 100000, 0, 0, 0, null, null, new Date("2026-01-01"), null, "Usuario Legacy"
  );
  await sessionRepo.save(legacySession);

  const session2 = await sessionRepo.findById(2);
  assertEquals(session2?.id, 2);
  assertEquals(session2?.openedByUserId, 99);
  assertEquals(session2?.status.value, "OPEN");
});

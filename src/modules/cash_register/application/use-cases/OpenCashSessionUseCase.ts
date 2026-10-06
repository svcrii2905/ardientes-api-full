import { CashSession } from "../../domain/CashSession.ts";
import { CashSessionStatus } from "../../domain/value-objects/CashSessionStatus.ts";
import { CashSessionRepository } from "../../domain/CashSessionRepository.ts";
import { CashRegisterRepository } from "../../domain/CashRegisterRepository.ts";
import { ValidationError, NotFoundError } from "../../../../shared/domain/error.ts";

export interface OpenCashSessionDTO {
  registerId: number;
  userId: number;
  openingBalance: number;
  notes?: string;
}

export class OpenCashSessionUseCase {
  constructor(
    private readonly cashSessionRepository: CashSessionRepository,
    private readonly cashRegisterRepository: CashRegisterRepository
  ) {}

  async execute(dto: OpenCashSessionDTO): Promise<CashSession> {
    if (!dto.userId || dto.userId <= 0) {
      throw new ValidationError("Se requiere el ID del usuario que abre la caja (userId)");
    }
    if (!dto.registerId || dto.registerId <= 0) {
      throw new ValidationError("Se requiere un ID de caja válido (registerId)");
    }
    if (typeof dto.openingBalance !== "number" || dto.openingBalance < 0) {
      throw new ValidationError("El saldo inicial de apertura no puede ser negativo");
    }

    // 1. Validar que la caja exista y esté activa
    const register = await this.cashRegisterRepository.findById(dto.registerId);
    if (!register) {
      throw new NotFoundError(`Caja registradora con ID ${dto.registerId} no encontrada`);
    }
    if (!register.isActive) {
      throw new ValidationError(`La caja registradora '${register.name}' no está activa`);
    }

    // 2. Regla de Negocio 1: No permitir dos sesiones abiertas para la misma caja
    const activeRegisterSession = await this.cashSessionRepository.findActiveByRegisterId(dto.registerId);
    if (activeRegisterSession) {
      const openedBy = activeRegisterSession.openedByUserName || `Usuario #${activeRegisterSession.openedByUserId}`;
      throw new ValidationError(
        `La caja '${register.name}' ya tiene una sesión abierta activa por ${openedBy} (Sesión #${activeRegisterSession.id})`
      );
    }

    // 3. Regla de Negocio 2: No permitir que un usuario abra dos sesiones simultáneas
    const activeUserSession = await this.cashSessionRepository.findActiveByUserId(dto.userId);
    if (activeUserSession) {
      throw new ValidationError(
        `El usuario con ID ${dto.userId} ya tiene una sesión de caja abierta activa (Sesión #${activeUserSession.id})`
      );
    }

    // 4. Instanciar la entidad CashSession
    const session = new CashSession(
      null,
      dto.userId,
      null, // closedByUserId
      dto.registerId,
      CashSessionStatus.open(),
      dto.openingBalance,
      0, // closingBalanceExpected (se calcula al cerrar)
      0, // closingBalanceReal (se calcula al cerrar)
      0, // discrepancyAmount (se calcula al cerrar)
      dto.notes?.trim() ?? null,
      null, // discrepancyNotes
      null, // openedAt
      null  // closedAt
    );

    // 5. Persistir la sesión abierta
    return await this.cashSessionRepository.save(session);
  }
}

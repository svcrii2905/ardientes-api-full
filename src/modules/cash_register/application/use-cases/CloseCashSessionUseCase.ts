import { CashSession } from "../../domain/CashSession.ts";
import { CashSessionRepository } from "../../domain/CashSessionRepository.ts";
import { CashTransactionRepository } from "../../domain/CashTransactionRepository.ts";
import { ValidationError, NotFoundError } from "../../../../shared/domain/error.ts";

export interface CloseCashSessionDTO {
  sessionId: number;
  userId: number;
  closingBalanceReal: number;
  discrepancyNotes?: string;
}

export class CloseCashSessionUseCase {
  constructor(
    private readonly cashSessionRepository: CashSessionRepository,
    private readonly cashTransactionRepository: CashTransactionRepository
  ) {}

  async execute(dto: CloseCashSessionDTO): Promise<CashSession> {
    if (!dto.sessionId || dto.sessionId <= 0) {
      throw new ValidationError("Se requiere un ID de sesión válido (sessionId)");
    }
    if (!dto.userId || dto.userId <= 0) {
      throw new ValidationError("Se requiere el ID del usuario responsable del cierre (userId)");
    }
    if (typeof dto.closingBalanceReal !== "number" || dto.closingBalanceReal < 0) {
      throw new ValidationError("El dinero contado en el arqueo no puede ser negativo");
    }

    // 1. Obtener la sesión de caja
    const session = await this.cashSessionRepository.findById(dto.sessionId);
    if (!session) {
      throw new NotFoundError(`Sesión de caja con ID ${dto.sessionId} no encontrada`);
    }

    if (!session.isOpen()) {
      throw new ValidationError(`La sesión de caja #${dto.sessionId} ya se encuentra CERRADA`);
    }

    // Regla de Negocio: Solo el usuario que abrió la sesión puede cerrarla
    if (session.openedByUserId !== dto.userId) {
      const openedBy = session.openedByUserName || `Usuario #${session.openedByUserId}`;
      throw new ValidationError(
        `No estás autorizado para cerrar esta sesión. La caja fue abierta por ${openedBy}. Únicamente este usuario puede realizar el cierre del turno.`
      );
    }

    // 2. Calcular automáticamente los totales de la sesión (efectivo esperado)
    const totals = await this.cashTransactionRepository.calculateSessionTotals(
      dto.sessionId,
      session.openingBalance
    );

    // 3. Aplicar regla de dominio de cierre de sesión
    session.close(
      dto.userId,
      dto.closingBalanceReal,
      totals.totalExpectedCash,
      dto.discrepancyNotes
    );

    // 4. Actualizar la sesión en base de datos
    return await this.cashSessionRepository.update(session);
  }
}

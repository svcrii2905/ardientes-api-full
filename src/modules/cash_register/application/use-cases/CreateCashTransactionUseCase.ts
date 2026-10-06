import { CashTransaction } from "../../domain/CashTransaction.ts";
import { CashTransactionRepository } from "../../domain/CashTransactionRepository.ts";
import { CashSessionRepository } from "../../domain/CashSessionRepository.ts";
import { CashTransactionType } from "../../domain/value-objects/CashTransactionType.ts";
import { ValidationError, NotFoundError } from "../../../../shared/domain/error.ts";

export interface CreateCashTransactionDTO {
  sessionId: number;
  transactionType: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  performedBy: number;
  notes: string;
}

export class CreateCashTransactionUseCase {
  constructor(
    private readonly cashTransactionRepository: CashTransactionRepository,
    private readonly cashSessionRepository: CashSessionRepository
  ) {}

  async execute(dto: CreateCashTransactionDTO): Promise<CashTransaction> {
    if (!dto.sessionId || dto.sessionId <= 0) {
      throw new ValidationError("Se requiere un sessionId válido");
    }
    if (!dto.performedBy || dto.performedBy <= 0) {
      throw new ValidationError("Se requiere el ID del usuario responsable (performedBy)");
    }
    if (typeof dto.amount !== "number" || isNaN(dto.amount) || dto.amount <= 0) {
      throw new ValidationError("El monto de la transacción debe ser mayor a 0");
    }
    if (dto.transactionType !== "DEPOSIT" && dto.transactionType !== "WITHDRAWAL") {
      throw new ValidationError("Tipo de transacción no válido. Valores permitidos: DEPOSIT, WITHDRAWAL");
    }
    if (!dto.notes || dto.notes.trim().length === 0) {
      throw new ValidationError("Se requiere una justificación/observación (notes) para registrar el movimiento");
    }

    // 1. Validar que la sesión de caja exista
    const session = await this.cashSessionRepository.findById(dto.sessionId);
    if (!session) {
      throw new NotFoundError(`Sesión de caja con ID ${dto.sessionId} no encontrada`);
    }

    // 2. Validar que la sesión esté abierta
    if (!session.isOpen()) {
      throw new ValidationError(`No se pueden registrar movimientos en una sesión de caja CERRADA (Sesión #${dto.sessionId})`);
    }

    // 3. Crear entidad de dominio
    const transaction = new CashTransaction(
      null,
      dto.sessionId,
      CashTransactionType.create(dto.transactionType),
      null, // orderPaymentId is null for manual transactions
      dto.amount,
      dto.performedBy,
      dto.notes.trim(),
      null
    );

    // 4. Guardar en base de datos
    return await this.cashTransactionRepository.save(transaction);
  }
}

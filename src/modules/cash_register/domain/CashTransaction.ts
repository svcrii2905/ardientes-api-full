import { ValidationError } from "../../../shared/domain/error.ts";
import { CashTransactionType } from "./value-objects/CashTransactionType.ts";

/**
 * Entidad CashTransaction representa un movimiento de dinero dentro de una sesión de caja.
 * Invariantes de dominio:
 * - sessionId, performedBy obligatorios.
 * - amount debe ser estrictamente > 0.
 */
export class CashTransaction {
  constructor(
    public readonly id: number | null,
    public readonly sessionId: number,
    public readonly transactionType: CashTransactionType,
    public readonly orderPaymentId: number | null,
    public readonly amount: number,
    public readonly performedBy: number,
    public readonly notes: string | null,
    public readonly createdAt: Date | null
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.sessionId || this.sessionId <= 0) {
      throw new ValidationError("La transacción requiere un sessionId válido");
    }
    if (!this.performedBy || this.performedBy <= 0) {
      throw new ValidationError("La transacción requiere un ID de usuario responsable (performedBy)");
    }
    if (typeof this.amount !== "number" || isNaN(this.amount) || this.amount <= 0) {
      throw new ValidationError("El monto de la transacción debe ser mayor a 0");
    }
  }
}

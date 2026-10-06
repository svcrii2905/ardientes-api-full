import { ValidationError } from "../../../shared/domain/error.ts";
import { PaymentStatus } from "./value-objects/PaymentStatus.ts";

/**
 * Entidad OrderPayment que representa una transacción de pago sobre un pedido.
 * Invariantes de dominio:
 * - orderId, paymentMethodId, sessionId obligatorios.
 * - amount debe ser estrictamente > 0.
 * - changeAmount no puede ser negativo.
 * - Solo se puede revertir un pago si su estado actual es COMPLETADO.
 */
export class OrderPayment {
  constructor(
    public readonly id: number | null,
    public readonly orderId: number,
    public readonly paymentMethodId: number,
    public readonly sessionId: number,
    public readonly amount: number,
    public readonly changeAmount: number,
    public readonly transactionReference: string | null,
    public status: PaymentStatus,
    public readonly notes: string | null,
    public readonly createdAt: Date | null
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.orderId || this.orderId <= 0) {
      throw new ValidationError("El pago requiere un orderId válido");
    }
    if (!this.paymentMethodId || this.paymentMethodId <= 0) {
      throw new ValidationError("El pago requiere un paymentMethodId válido");
    }
    if (!this.sessionId || this.sessionId <= 0) {
      throw new ValidationError("El pago requiere un sessionId válido");
    }
    if (typeof this.amount !== "number" || isNaN(this.amount) || this.amount <= 0) {
      throw new ValidationError("El monto del pago debe ser un número mayor a 0");
    }
    if (typeof this.changeAmount !== "number" || isNaN(this.changeAmount) || this.changeAmount < 0) {
      throw new ValidationError("El monto de cambio (vuelto) no puede ser negativo");
    }
  }

  public revert(): void {
    this.status = this.status.transitionTo("REVERTIDO");
  }
}

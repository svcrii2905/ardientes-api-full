import { ValidationError } from "../../../../shared/domain/error.ts";

export type PaymentStatusValue = "COMPLETADO" | "REVERTIDO";

/**
 * Value Object para el estado de un pago.
 * Máquina de estados:
 * COMPLETADO -> REVERTIDO
 */
export class PaymentStatus {
  private constructor(public readonly value: PaymentStatusValue) {}

  public static create(value: string): PaymentStatus {
    if (!value || typeof value !== "string") {
      throw new ValidationError("El estado del pago es requerido");
    }
    const uppercaseVal = value.toUpperCase() as PaymentStatusValue;
    if (!["COMPLETADO", "REVERTIDO"].includes(uppercaseVal)) {
      throw new ValidationError(
        `Estado de pago no válido: '${value}'. Valores permitidos: COMPLETADO, REVERTIDO`
      );
    }
    return new PaymentStatus(uppercaseVal);
  }

  public static completado(): PaymentStatus {
    return new PaymentStatus("COMPLETADO");
  }

  public static revertido(): PaymentStatus {
    return new PaymentStatus("REVERTIDO");
  }

  public isCompletado(): boolean {
    return this.value === "COMPLETADO";
  }

  public isRevertido(): boolean {
    return this.value === "REVERTIDO";
  }

  public canTransitionTo(targetStatus: PaymentStatusValue): boolean {
    if (this.isCompletado() && targetStatus === "REVERTIDO") {
      return true;
    }
    return false;
  }

  public transitionTo(targetStatus: PaymentStatusValue): PaymentStatus {
    if (!this.canTransitionTo(targetStatus)) {
      throw new ValidationError(
        `Transición de estado no permitida de '${this.value}' a '${targetStatus}'`
      );
    }
    return PaymentStatus.create(targetStatus);
  }
}

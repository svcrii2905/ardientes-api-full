import { ValidationError } from "../../../../shared/domain/error.ts";

export type CashSessionStatusValue = "OPEN" | "CLOSED";

/**
 * Value Object para el estado de una sesión de caja.
 * Máquina de estados: OPEN -> CLOSED
 */
export class CashSessionStatus {
  private constructor(public readonly value: CashSessionStatusValue) {}

  public static create(value: string): CashSessionStatus {
    if (!value || typeof value !== "string") {
      throw new ValidationError("El estado de la sesión de caja es requerido");
    }
    const uppercaseVal = value.toUpperCase() as CashSessionStatusValue;
    if (!["OPEN", "CLOSED"].includes(uppercaseVal)) {
      throw new ValidationError(
        `Estado de sesión de caja no válido: '${value}'. Valores permitidos: OPEN, CLOSED`
      );
    }
    return new CashSessionStatus(uppercaseVal);
  }

  public static open(): CashSessionStatus {
    return new CashSessionStatus("OPEN");
  }

  public static closed(): CashSessionStatus {
    return new CashSessionStatus("CLOSED");
  }

  public isOpen(): boolean {
    return this.value === "OPEN";
  }

  public isClosed(): boolean {
    return this.value === "CLOSED";
  }

  public canTransitionTo(targetStatus: CashSessionStatusValue): boolean {
    if (this.isOpen() && targetStatus === "CLOSED") {
      return true;
    }
    return false;
  }

  public transitionTo(targetStatus: CashSessionStatusValue): CashSessionStatus {
    if (!this.canTransitionTo(targetStatus)) {
      throw new ValidationError(
        `Transición de estado no permitida de '${this.value}' a '${targetStatus}'`
      );
    }
    return CashSessionStatus.create(targetStatus);
  }
}

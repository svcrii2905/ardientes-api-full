import { ValidationError } from "../../../../shared/domain/error.ts";

export type PaymentMethodTypeValue = "CASH" | "DIGITAL" | "CARD";

/**
 * Value Object para el tipo de método de pago.
 * Reglas de negocio:
 * - CASH: Dinero en efectivo (se computa para el dinero físico en arqueo de caja).
 * - DIGITAL: Pago digital (Nequi, Daviplata, PSE - usualmente requiere número de referencia).
 * - CARD: Tarjeta débito/crédito.
 */
export class PaymentMethodType {
  private constructor(public readonly value: PaymentMethodTypeValue) {}

  public static create(value: string): PaymentMethodType {
    if (!value || typeof value !== "string") {
      throw new ValidationError("El tipo de método de pago es requerido");
    }
    const uppercaseVal = value.toUpperCase() as PaymentMethodTypeValue;
    if (!["CASH", "DIGITAL", "CARD"].includes(uppercaseVal)) {
      throw new ValidationError(
        `Tipo de método de pago no válido: '${value}'. Valores permitidos: CASH, DIGITAL, CARD`
      );
    }
    return new PaymentMethodType(uppercaseVal);
  }

  public isCash(): boolean {
    return this.value === "CASH";
  }

  public isDigital(): boolean {
    return this.value === "DIGITAL";
  }

  public isCard(): boolean {
    return this.value === "CARD";
  }

  public equals(other: PaymentMethodType): boolean {
    return this.value === other.value;
  }
}

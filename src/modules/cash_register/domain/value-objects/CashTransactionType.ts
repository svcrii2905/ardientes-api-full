import { ValidationError } from "../../../../shared/domain/error.ts";

export type CashTransactionTypeValue = "DEPOSIT" | "WITHDRAWAL" | "ORDER_PAYMENT";

/**
 * Value Object para el tipo de transacción de caja.
 * - DEPOSIT: Ingreso de efectivo adicional a la caja (ej: adición de base o fondo).
 * - WITHDRAWAL: Retiro de efectivo de la caja (ej: pago a proveedor, retiro parcial o reversión).
 * - ORDER_PAYMENT: Ingreso por pago de pedido en el POS.
 */
export class CashTransactionType {
  private constructor(public readonly value: CashTransactionTypeValue) {}

  public static create(value: string): CashTransactionType {
    if (!value || typeof value !== "string") {
      throw new ValidationError("El tipo de transacción de caja es requerido");
    }
    const uppercaseVal = value.toUpperCase() as CashTransactionTypeValue;
    if (!["DEPOSIT", "WITHDRAWAL", "ORDER_PAYMENT"].includes(uppercaseVal)) {
      throw new ValidationError(
        `Tipo de transacción no válido: '${value}'. Valores permitidos: DEPOSIT, WITHDRAWAL, ORDER_PAYMENT`
      );
    }
    return new CashTransactionType(uppercaseVal);
  }

  public isDeposit(): boolean {
    return this.value === "DEPOSIT";
  }

  public isWithdrawal(): boolean {
    return this.value === "WITHDRAWAL";
  }

  public isOrderPayment(): boolean {
    return this.value === "ORDER_PAYMENT";
  }
}

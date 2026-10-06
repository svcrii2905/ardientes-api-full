import { ValidationError } from "../../../../shared/domain/error.ts";

export type OrderTypeValue = "MESA" | "RECOGER" | "DOMICILIO";

const VALID_ORDER_TYPES: OrderTypeValue[] = ["MESA", "RECOGER", "DOMICILIO"];

export class OrderType {
  private constructor(public readonly value: OrderTypeValue) {}

  static create(value: string): OrderType {
    const normalized = value?.toUpperCase();
    if (!VALID_ORDER_TYPES.includes(normalized as OrderTypeValue)) {
      throw new ValidationError(
        `Tipo de pedido inválido: '${value}'. Los valores válidos son: ${VALID_ORDER_TYPES.join(", ")}`
      );
    }
    return new OrderType(normalized as OrderTypeValue);
  }

  static fromDB(value: string): OrderType {
    return new OrderType(value as OrderTypeValue);
  }

  isMesa(): boolean {
    return this.value === "MESA";
  }

  isRecoger(): boolean {
    return this.value === "RECOGER";
  }

  isDomicilio(): boolean {
    return this.value === "DOMICILIO";
  }

  toString(): string {
    return this.value;
  }
}

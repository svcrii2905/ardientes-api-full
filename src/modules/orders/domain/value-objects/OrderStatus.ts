import { ValidationError } from "../../../../shared/domain/error.ts";

export type OrderStatusValue =
  | "PENDIENTE"
  | "CONFIRMADO"
  | "EN_PREPARACION"
  | "LISTO"
  | "EN_CAMINO"
  | "ENTREGADO"
  | "CANCELADO";

/**
 * Mapa de transiciones de estado válidas.
 * Clave: estado actual → Valor: lista de estados a los que puede pasar.
 */
const VALID_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
    PENDIENTE: ["CONFIRMADO", "CANCELADO"],
    CONFIRMADO: ["EN_PREPARACION", "CANCELADO"],
    EN_PREPARACION: ["LISTO", "CANCELADO"],
    LISTO: ["ENTREGADO", "EN_CAMINO"],
    EN_CAMINO: ["ENTREGADO", "CANCELADO"],
    ENTREGADO: [],        // Estado terminal
    CANCELADO: [],        // Estado terminal
  };

export class OrderStatus {
  private constructor(public readonly value: OrderStatusValue) {}

  static create(value: string): OrderStatus {
    const normalized = value?.toUpperCase().replace(" ", "_") as OrderStatusValue;
    if (!Object.keys(VALID_TRANSITIONS).includes(normalized)) {
      throw new ValidationError(
        `Estado de pedido inválido: '${value}'. Los valores válidos son: ${Object.keys(VALID_TRANSITIONS).join(", ")}`
      );
    }
    return new OrderStatus(normalized);
  }

  static fromDB(value: string): OrderStatus {
    return new OrderStatus(value as OrderStatusValue);
  }

  static initial(): OrderStatus {
    return new OrderStatus("PENDIENTE");
  }

  canTransitionTo(next: OrderStatusValue): boolean {
    return VALID_TRANSITIONS[this.value].includes(next);
  }

  transitionTo(next: OrderStatusValue): OrderStatus {
    if (!this.canTransitionTo(next)) {
      throw new ValidationError(
        `Transición de estado inválida: '${this.value}' → '${next}'. ` +
          `Transiciones válidas desde '${this.value}': [${VALID_TRANSITIONS[this.value].join(", ") || "ninguna"}]`
      );
    }
    return new OrderStatus(next);
  }

  isTerminal(): boolean {
    return this.value === "ENTREGADO" || this.value === "CANCELADO";
  }

  isCancelled(): boolean {
    return this.value === "CANCELADO";
  }

  isPending(): boolean {
    return this.value === "PENDIENTE";
  }

  toString(): string {
    return this.value;
  }
}

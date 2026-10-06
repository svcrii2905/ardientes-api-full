import { ValidationError } from "../../../shared/domain/error.ts";

/**
 * Bebida dentro de un pedido (independiente o perteneciente a un combo).
 * Almacena precio histórico al momento del pedido.
 * NUNCA se consulta el precio actual de la bebida después de creado el pedido.
 */
export class OrderBeverage {
  constructor(
    public readonly id: number | null,
    public readonly orderId: number | null,      // null antes de persistir
    public readonly beverageId: number,
    public readonly orderComboId: number | null, // null si es bebida suelta
    public readonly quantity: number,
    public readonly unitPrice: number,           // Precio histórico (snapshot)
    public readonly beverageName: string | null = null
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.quantity <= 0) {
      throw new ValidationError("La cantidad de bebida debe ser mayor a 0");
    }
    if (this.unitPrice < 0) {
      throw new ValidationError("El precio unitario de la bebida no puede ser negativo");
    }
  }

  get lineTotal(): number {
    return this.unitPrice * this.quantity;
  }
}

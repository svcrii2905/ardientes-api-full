import { ValidationError } from "../../../shared/domain/error.ts";
import { OrderItem } from "./OrderItem.ts";
import { OrderBeverage } from "./OrderBeverage.ts";

/**
 * Combo dentro de un pedido.
 * Almacena nombre y precio histórico al momento del pedido.
 * NUNCA se consulta el precio actual del combo después de creado el pedido.
 * 
 * Los ítems y bebidas que pertenecen al combo referencian este OrderCombo
 * a través de orderComboId.
 */
export class OrderCombo {
  constructor(
    public readonly id: number | null,
    public readonly orderId: number | null,   // null antes de persistir
    public readonly comboId: number,
    public readonly comboName: string,        // Nombre histórico (snapshot)
    public readonly quantity: number,
    public readonly unitPrice: number,        // Precio histórico (snapshot)
    public readonly items: OrderItem[],       // Ítems que forman el combo
    public readonly beverages: OrderBeverage[] // Bebidas que forman el combo
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.quantity <= 0) {
      throw new ValidationError("La cantidad del combo debe ser mayor a 0");
    }
    if (this.unitPrice < 0) {
      throw new ValidationError("El precio unitario del combo no puede ser negativo");
    }
    if (!this.comboName || this.comboName.trim().length === 0) {
      throw new ValidationError("El nombre del combo no puede estar vacío");
    }
  }

  get lineTotal(): number {
    return this.unitPrice * this.quantity;
  }
}

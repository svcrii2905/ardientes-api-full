import { ValidationError } from "../../../shared/domain/error.ts";
import { MenuTypeValue } from "./value-objects/MenuType.ts";
import { OrderItemTopping } from "./OrderItemTopping.ts";

/**
 * Ítem de producto dentro de un pedido.
 * Almacena el precio histórico (unitPrice) al momento del pedido.
 * NUNCA se consulta el precio actual del producto después de creado el pedido.
 */
export class OrderItem {
  constructor(
    public readonly id: number | null,
    public readonly orderId: number | null,       // null antes de persistir
    public readonly productId: number,
    public readonly orderComboId: number | null,  // Solo si forma parte de un combo
    public readonly quantity: number,
    public readonly menuType: MenuTypeValue,
    public readonly unitPrice: number,            // Precio histórico (snapshot)
    public readonly toppingsExtraPrice: number,   // Suma total de toppings
    public readonly notes: string | null,
    public readonly toppings: OrderItemTopping[] = [],
    public readonly productName: string | null = null
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.quantity <= 0) {
      throw new ValidationError("La cantidad del ítem debe ser mayor a 0");
    }
    if (this.unitPrice < 0) {
      throw new ValidationError("El precio unitario no puede ser negativo");
    }
    if (this.toppingsExtraPrice < 0) {
      throw new ValidationError("El precio extra de toppings no puede ser negativo");
    }
  }

  get lineTotal(): number {
    return (this.unitPrice + this.toppingsExtraPrice) * this.quantity;
  }
}

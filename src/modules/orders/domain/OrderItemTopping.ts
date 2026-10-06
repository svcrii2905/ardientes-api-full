/**
 * Topping seleccionado dentro de un OrderItem.
 * Almacena el nombre y precio histórico al momento del pedido.
 * NUNCA se consulta el precio actual del topping después de creado el pedido.
 */
export class OrderItemTopping {
  constructor(
    public readonly id: number | null,
    public readonly orderItemId: number | null, // null antes de persistir
    public readonly toppingId: number,
    public readonly toppingName: string,         // Precio histórico (snapshot)
    public readonly quantity: number,
    public readonly extraPrice: number           // Precio histórico (snapshot)
  ) {}

  get lineTotal(): number {
    return this.extraPrice * this.quantity;
  }
}

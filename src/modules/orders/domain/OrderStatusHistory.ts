import { OrderStatusValue } from "./value-objects/OrderStatus.ts";

/**
 * Registro inmutable de un cambio de estado en un pedido.
 * Se inserta en `order_status_history` en cada transición.
 */
export class OrderStatusHistory {
  constructor(
    public readonly id: number | null,
    public readonly orderId: number,
    public readonly fromStatus: OrderStatusValue,
    public readonly toStatus: OrderStatusValue,
    public readonly changedBy: number,          // user_id
    public readonly notes: string | null,
    public readonly createdAt: Date | null
  ) {}
}

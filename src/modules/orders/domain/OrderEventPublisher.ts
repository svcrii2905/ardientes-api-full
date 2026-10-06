import { Order } from "./Order.ts";

/**
 * Contrato del dominio para la publicación de eventos de órdenes en tiempo real.
 * Permite que los casos de uso notifiquen cambios sin acoplarse a la tecnología de transporte (WebSockets, etc.).
 */
export interface OrderEventPublisher {
  /**
   * Notifica que se ha creado un nuevo pedido.
   */
  notifyOrderCreated(order: Order): void;

  /**
   * Notifica que el estado de un pedido ha cambiado (ej. CONFIRMADO -> EN_PREPARACION -> LISTO).
   */
  notifyOrderStatusChanged(order: Order, previousStatus: string): void;

  /**
   * Notifica que un pedido ha sido cancelado.
   */
  notifyOrderCancelled(order: Order, reason: string): void;
}

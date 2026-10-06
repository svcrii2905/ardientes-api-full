import { Order } from "./Order.ts";
import { OrderStatusHistory } from "./OrderStatusHistory.ts";
import { OrderStatusValue } from "./value-objects/OrderStatus.ts";
import { OrderTypeValue } from "./value-objects/OrderType.ts";

export interface OrderFilters {
  status?: OrderStatusValue;
  orderType?: OrderTypeValue;
  customerId?: number;
  userId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Puerto de salida del dominio para la persistencia de pedidos.
 * Las implementaciones concretas viven en la capa de infraestructura.
 */
export interface OrderRepository {
  /**
   * Persiste un pedido completo en una transacción atómica.
   * Incluye: order_items, order_item_toppings, order_beverages, order_combos.
   */
  save(order: Order): Promise<Order>;

  /**
   * Busca un pedido por su ID incluyendo todos los ítems anidados.
   */
  findById(id: number): Promise<Order | null>;

  /**
   * Busca un pedido por su número único de orden.
   */
  findByOrderNumber(orderNumber: string): Promise<Order | null>;

  /**
   * Lista pedidos con filtros opcionales y paginación.
   * No incluye ítems anidados (vista de lista liviana).
   */
  findAll(filters?: OrderFilters): Promise<Order[]>;

  /**
   * Actualiza el estado del pedido en la base de datos.
   */
  updateStatus(orderId: number, status: OrderStatusValue): Promise<void>;

  /**
   * Actualiza el timestamp de entrada a cocina de un pedido.
   */
  updateKitchenStartedAt(orderId: number, date: Date): Promise<void>;

  /**
   * Obtiene los pedidos para la pantalla de cocina (KDS) con sus ítems, toppings y bebidas,
   * ordenados cronológicamente (más antiguo primero).
   */
  findKitchenOrders(activeOnly?: boolean): Promise<Order[]>;

  /**
   * Obtiene los pedidos asociados a una mesa con todos sus ítems, toppings y bebidas.
   * Por defecto solo incluye pedidos activos / no cancelados ni pagados.
   */
  findByTableId(tableId: number, activeOnly?: boolean): Promise<Order[]>;

  /**
   * Despacha atómicamente un pedido a un domiciliario.
   * Cambia estado de LISTO a EN_CAMINO, asigna deliveryUserId, y registra historial.
   * Devuelve true si tuvo éxito, o false si el pedido ya fue despachado u otro error de concurrencia.
   */
  dispatchDelivery(orderId: number, deliveryUserId: number | null, deliveryCompany: string | null, changedBy: number): Promise<boolean>;

  /**
   * Inserta un registro de cambio de estado en `order_status_history`.
   */
  saveStatusHistory(history: OrderStatusHistory): Promise<OrderStatusHistory>;
}

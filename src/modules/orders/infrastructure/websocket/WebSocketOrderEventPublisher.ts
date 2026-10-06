import { Order } from "../../domain/Order.ts";
import { OrderEventPublisher } from "../../domain/OrderEventPublisher.ts";
import { webSocketHub, WebSocketHub } from "../../../../shared/infrastructure/websocket/WebSocketHub.ts";

export class WebSocketOrderEventPublisher implements OrderEventPublisher {
  constructor(private readonly hub: WebSocketHub = webSocketHub) {}

  notifyOrderCreated(order: Order): void {
    this.hub.broadcast("ORDER_CREATED", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status.value,
      orderType: order.orderType.value,
      tableId: order.tableId,
      customerName: order.customerName,
      total: order.total,
      notes: order.notes,
      kitchenStartedAt: order.kitchenStartedAt?.toISOString() ?? null,
      createdAt: order.createdAt?.toISOString() ?? new Date().toISOString(),
      items: (order.items || []).map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        menuType: item.menuType,
        unitPrice: item.unitPrice,
        notes: item.notes,
        toppings: (item.toppings || []).map((t) => ({
          toppingId: t.toppingId,
          toppingName: t.toppingName,
          quantity: t.quantity,
        })),
      })),
      beverages: (order.beverages || []).map((b) => ({
        beverageId: b.beverageId,
        beverageName: b.beverageName,
        quantity: b.quantity,
      })),
    });
  }

  notifyOrderStatusChanged(order: Order, previousStatus: string): void {
    this.hub.broadcast("ORDER_STATUS_CHANGED", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      previousStatus,
      newStatus: order.status.value,
      kitchenStartedAt: order.kitchenStartedAt?.toISOString() ?? null,
      updatedAt: order.updatedAt?.toISOString() ?? new Date().toISOString(),
    });
  }

  notifyOrderCancelled(order: Order, reason: string): void {
    this.hub.broadcast("ORDER_CANCELLED", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: "CANCELADO",
      reason,
      cancelledAt: new Date().toISOString(),
    });
  }
}

export const webSocketOrderEventPublisher = new WebSocketOrderEventPublisher();

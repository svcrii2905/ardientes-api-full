import { Order } from "../../domain/Order.ts";
import { OrderRepository } from "../../domain/OrderRepository.ts";
import { OrderEventPublisher } from "../../domain/OrderEventPublisher.ts";
import { OrderStatusHistory } from "../../domain/OrderStatusHistory.ts";
import { NotFoundError, ValidationError } from "../../../../shared/domain/error.ts";

export interface CancelOrderDTO {
  orderId: number;
  cancelledBy: number; // userId del operador que cancela
  reason: string;      // Motivo de cancelación (obligatorio)
}

import { TableRepository } from "../../../tables/domain/TableRepository.ts";
import { TableEventPublisher } from "../../../tables/domain/TableEventPublisher.ts";

export class CancelOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventPublisher?: OrderEventPublisher,
    private readonly tableRepository?: TableRepository,
    private readonly tableEventPublisher?: TableEventPublisher
  ) {}

  async execute(dto: CancelOrderDTO): Promise<Order> {
    // 1. Validar que se proporciona un motivo
    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new ValidationError("Se requiere un motivo para cancelar el pedido");
    }

    // 2. Buscar el pedido
    const order = await this.orderRepository.findById(dto.orderId);
    if (!order) {
      throw new NotFoundError(`Pedido con ID ${dto.orderId} no encontrado`);
    }

    // 3. Verificar que el pedido puede ser cancelado
    if (!order.canBeCancelled()) {
      throw new ValidationError(
        `El pedido #${order.orderNumber} en estado '${order.status.value}' no puede ser cancelado. ` +
          `Solo se pueden cancelar pedidos en estado PENDIENTE o EN_PREPARACION.`
      );
    }

    // 4. Capturar estado anterior
    const fromStatus = order.status.value;

    // 5. Cancelar el pedido (actualiza el value object internamente)
    order.cancel();

    // 6. Persistir
    await this.orderRepository.updateStatus(dto.orderId, "CANCELADO");

    // 7. Registrar historial
    const history = new OrderStatusHistory(
      null,
      dto.orderId,
      fromStatus,
      "CANCELADO",
      dto.cancelledBy,
      dto.reason,
      null
    );
    await this.orderRepository.saveStatusHistory(history);

    // ─────────────────────────────────────────────────────────────────────────
    // [EXTENSION POINT] Inventario — revertir consumo de ingredientes
    // await this.inventoryService.restockForCancelledOrder(order);
    // ─────────────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────────
    // [EXTENSION POINT] Fidelización — revertir puntos si ya se acumularon
    // await this.loyaltyService.reversePointsForOrder(order);
    // ─────────────────────────────────────────────────────────────────────────

    // Notificar evento en tiempo real vía WebSocket
    this.eventPublisher?.notifyOrderCancelled(order, dto.reason);

    // Gestión de Mesas (Bloque 4): Si el pedido pertenecía a una mesa, verificar si quedan otros pedidos pendientes
    if (order.tableId && this.tableRepository && this.tableEventPublisher) {
      const pendingCount = await this.tableRepository.countPendingOrders(order.tableId);
      if (pendingCount === 0) {
        await this.tableRepository.updateStatus(order.tableId, "LIBRE");
        await this.tableRepository.updateAccountRequested(order.tableId, false);
        const freedTable = await this.tableRepository.findById(order.tableId);
        if (freedTable) {
          this.tableEventPublisher.notifyTableStatusChanged(freedTable);
        }
      }
    }

    return order;
  }
}

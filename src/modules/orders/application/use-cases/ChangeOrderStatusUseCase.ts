import { Order } from "../../domain/Order.ts";
import { OrderRepository } from "../../domain/OrderRepository.ts";
import { OrderEventPublisher } from "../../domain/OrderEventPublisher.ts";
import { OrderStatusHistory } from "../../domain/OrderStatusHistory.ts";
import { OrderStatusValue } from "../../domain/value-objects/OrderStatus.ts";
import {
  NotFoundError,
  ValidationError,
} from "../../../../shared/domain/error.ts";

export interface ChangeOrderStatusDTO {
  orderId: number;
  newStatus: string;
  changedBy: number;
  notes?: string;
}

export class ChangeOrderStatusUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventPublisher?: OrderEventPublisher,
  ) { }

  async execute(dto: ChangeOrderStatusDTO): Promise<Order> {
    // 1. Buscar el pedido
    const order = await this.orderRepository.findById(dto.orderId);

    if (!order) {
      throw new NotFoundError(
        "Pedido con ID " + dto.orderId + " no encontrado",
      );
    }

    // 2. Normalizar el estado recibido
    const upperStatus = dto.newStatus
      .toUpperCase()
      .replace(" ", "_") as OrderStatusValue;

    // 3. Estados válidos
    const validStatuses: OrderStatusValue[] = [
      "PENDIENTE",
      "CONFIRMADO",
      "EN_PREPARACION",
      "LISTO",
      "ENTREGADO",
      "CANCELADO",
    ];

    if (!validStatuses.includes(upperStatus)) {
      throw new ValidationError(
        "Estado '" +
        dto.newStatus +
        "' no reconocido. Los valores válidos son: " +
        validStatuses.join(", "),
      );
    }

    // 4. Guardar el estado anterior
    const fromStatus = order.status.value;

    // 5. Validar y realizar la transición
    order.transitionStatus(upperStatus);

    // 6. Persistir el nuevo estado
    await this.orderRepository.updateStatus(
      dto.orderId,
      upperStatus,
    );

    // Si el pedido ingresó a cocina (CONFIRMADO / EN_PREPARACION), persistir kitchen_started_at
    if (order.kitchenStartedAt && (upperStatus === "CONFIRMADO" || upperStatus === "EN_PREPARACION")) {
      await this.orderRepository.updateKitchenStartedAt(dto.orderId, order.kitchenStartedAt);
    }

    // 7. Registrar el cambio en el historial
    const history = new OrderStatusHistory(
      null,
      dto.orderId,
      fromStatus,
      upperStatus,
      dto.changedBy,
      dto.notes ?? null,
      null,
    );

    await this.orderRepository.saveStatusHistory(history);

    // 8. Notificar evento en tiempo real vía WebSocket
    this.eventPublisher?.notifyOrderStatusChanged(order, fromStatus);

    // 9. Devolver el pedido actualizado
    return order;
  }
}
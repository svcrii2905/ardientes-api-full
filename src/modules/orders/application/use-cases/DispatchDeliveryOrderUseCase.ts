import { Order } from "../../domain/Order.ts";
import { OrderRepository } from "../../domain/OrderRepository.ts";
import { OrderEventPublisher } from "../../domain/OrderEventPublisher.ts";
import { ListDriversUseCase } from "../../../auth/application/use-cases/ListDriversUseCase.ts";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../../../shared/domain/error.ts";

export interface DispatchDeliveryOrderDTO {
  orderId: number;
  deliveryUserId?: number;
  deliveryCompany?: string;
  changedBy: number;
}

export class DispatchDeliveryOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly listDriversUseCase: ListDriversUseCase,
    private readonly eventPublisher?: OrderEventPublisher,
  ) { }

  async execute(dto: DispatchDeliveryOrderDTO): Promise<Order> {
    if (!dto.deliveryUserId && !dto.deliveryCompany) {
      throw new ValidationError("Debe especificar un domiciliario interno o una empresa de domicilio.");
    }
    if (dto.deliveryUserId && dto.deliveryCompany) {
      throw new ValidationError("No puede especificar un domiciliario interno y una empresa de domicilio simultáneamente.");
    }

    if (dto.deliveryUserId) {
      // Validar el usuario domiciliario
      const drivers = await this.listDriversUseCase.execute();
      const isValidDriver = drivers.some(driver => driver.id === dto.deliveryUserId);

      if (!isValidDriver) {
        throw new ValidationError(
          `Usuario con ID ${dto.deliveryUserId} no encontrado o no tiene el rol DOMICILIARIO activo.`
        );
      }
    }

    // 2. Buscar el pedido original
    const order = await this.orderRepository.findById(dto.orderId);

    if (!order) {
      throw new NotFoundError(`Pedido con ID ${dto.orderId} no encontrado.`);
    }

    if (order.orderType.value !== "DOMICILIO") {
      throw new ValidationError("Solo se pueden despachar pedidos de tipo DOMICILIO.");
    }

    if (order.status.value !== "LISTO") {
      throw new ValidationError("El pedido debe estar en estado LISTO para ser despachado.");
    }

    const fromStatus = order.status.value;

    // 3. Ejecutar actualización atómica y concurrente
    const success = await this.orderRepository.dispatchDelivery(
      dto.orderId,
      dto.deliveryUserId ?? null,
      dto.deliveryCompany ?? null,
      dto.changedBy
    );

    if (!success) {
      throw new ConflictError("El pedido ya fue despachado por otro cajero o cambió de estado.");
    }

    order.deliveryUserId = dto.deliveryUserId ?? null;
    order.deliveryCompany = dto.deliveryCompany ?? null;
    order.transitionStatus("EN_CAMINO");

    // 5. Publicar evento WebSocket (arquitectura existente)
    this.eventPublisher?.notifyOrderStatusChanged(order, fromStatus);

    return order;
  }
}

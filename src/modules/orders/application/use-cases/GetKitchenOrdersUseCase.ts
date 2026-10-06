import { Order } from "../../domain/Order.ts";
import { OrderRepository } from "../../domain/OrderRepository.ts";

export interface GetKitchenOrdersDTO {
  activeOnly?: boolean;
}

/**
 * Caso de uso: Obtener pedidos para el Kitchen Display System (KDS).
 * Retorna los pedidos que cocina debe preparar o despachar con todos sus ítems,
 * toppings y bebidas, ordenados del más antiguo al más reciente.
 */
export class GetKitchenOrdersUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(dto: GetKitchenOrdersDTO = {}): Promise<Order[]> {
    const activeOnly = dto.activeOnly ?? true;
    return await this.orderRepository.findKitchenOrders(activeOnly);
  }
}

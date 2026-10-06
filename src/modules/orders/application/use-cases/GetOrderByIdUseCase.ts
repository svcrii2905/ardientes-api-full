import { Order } from "../../domain/Order.ts";
import { OrderRepository } from "../../domain/OrderRepository.ts";
import { NotFoundError } from "../../../../shared/domain/error.ts";

export class GetOrderByIdUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(id: number): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundError(`Pedido con ID ${id} no encontrado`);
    }
    return order;
  }
}

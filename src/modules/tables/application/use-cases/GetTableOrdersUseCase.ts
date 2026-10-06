import { Order } from "../../../orders/domain/Order.ts";
import { OrderRepository } from "../../../orders/domain/OrderRepository.ts";
import { TableRepository } from "../../domain/TableRepository.ts";
import { NotFoundError } from "../../../../shared/domain/error.ts";

export class GetTableOrdersUseCase {
  constructor(
    private readonly tableRepository: TableRepository,
    private readonly orderRepository: OrderRepository
  ) {}

  async execute(tableId: number, activeOnly = true): Promise<Order[]> {
    const table = await this.tableRepository.findById(tableId);
    if (!table) {
      throw new NotFoundError(`Mesa con ID ${tableId} no encontrada`);
    }

    return await this.orderRepository.findByTableId(tableId, activeOnly);
  }
}

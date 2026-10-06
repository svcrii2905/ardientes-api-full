import { Order } from "../../domain/Order.ts";
import { OrderRepository, OrderFilters } from "../../domain/OrderRepository.ts";
import { OrderStatusValue } from "../../domain/value-objects/OrderStatus.ts";
import { OrderTypeValue } from "../../domain/value-objects/OrderType.ts";

export interface ListOrdersDTO {
  status?: OrderStatusValue;
  orderType?: OrderTypeValue;
  customerId?: number;
  userId?: number;
  dateFrom?: string; // ISO string
  dateTo?: string;   // ISO string
  limit?: number;
  offset?: number;
}

export class ListOrdersUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(dto: ListOrdersDTO = {}): Promise<Order[]> {
    const filters: OrderFilters = {
      status: dto.status,
      orderType: dto.orderType,
      customerId: dto.customerId,
      userId: dto.userId,
      limit: dto.limit ?? 50,
      offset: dto.offset ?? 0,
    };

    if (dto.dateFrom) {
      filters.dateFrom = new Date(dto.dateFrom);
    }
    if (dto.dateTo) {
      filters.dateTo = new Date(dto.dateTo);
    }

    return await this.orderRepository.findAll(filters);
  }
}

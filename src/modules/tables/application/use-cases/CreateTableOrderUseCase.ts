import { Order } from "../../../orders/domain/Order.ts";
import { CreateOrderUseCase, CreateOrderDTO } from "../../../orders/application/use-cases/CreateOrderUseCase.ts";
import { TableRepository } from "../../domain/TableRepository.ts";
import { TableEventPublisher } from "../../domain/TableEventPublisher.ts";
import { NotFoundError } from "../../../../shared/domain/error.ts";

export interface CreateTableOrderDTO extends Omit<CreateOrderDTO, "orderType" | "tableId" | "deliveryAddress" | "deliveryUserId"> {
  tableId: number;
}

export class CreateTableOrderUseCase {
  constructor(
    private readonly tableRepository: TableRepository,
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly tableEventPublisher: TableEventPublisher
  ) {}

  async execute(dto: CreateTableOrderDTO): Promise<Order> {
    // 1. Validar que la mesa existe en MySQL
    const table = await this.tableRepository.findById(dto.tableId);
    if (!table) {
      throw new NotFoundError(`Mesa con ID ${dto.tableId} no encontrada`);
    }

    // 2. Reutilizar CreateOrderUseCase con orderType forzado a 'MESA' y tableId
    const order = await this.createOrderUseCase.execute({
      ...dto,
      orderType: "MESA",
      tableId: dto.tableId,
    });

    // 3. Si la mesa estaba LIBRE, actualizar a OCUPADA únicamente después de persistir el pedido
    if (table.isLibre()) {
      table.occupy();
      await this.tableRepository.updateStatus(table.id, "OCUPADA");
      this.tableEventPublisher.notifyTableStatusChanged(table);
    }

    return order;
  }
}

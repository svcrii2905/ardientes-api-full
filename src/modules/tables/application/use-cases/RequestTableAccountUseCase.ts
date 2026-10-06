import { Table } from "../../domain/Table.ts";
import { TableRepository } from "../../domain/TableRepository.ts";
import { TableEventPublisher } from "../../domain/TableEventPublisher.ts";
import { NotFoundError, ValidationError } from "../../../../shared/domain/error.ts";

export class RequestTableAccountUseCase {
  constructor(
    private readonly tableRepository: TableRepository,
    private readonly tableEventPublisher: TableEventPublisher
  ) {}

  async execute(tableId: number): Promise<Table> {
    const table = await this.tableRepository.findById(tableId);
    if (!table) {
      throw new NotFoundError(`Mesa con ID ${tableId} no encontrada`);
    }

    if (!table.isOcupada()) {
      throw new ValidationError(`No se puede solicitar la cuenta de la ${table.name} porque está LIBRE`);
    }

    const pendingOrdersCount = await this.tableRepository.countPendingOrders(tableId);
    if (pendingOrdersCount === 0) {
      throw new ValidationError(`La ${table.name} no tiene pedidos activos pendientes de cobro`);
    }

    table.requestAccount();
    await this.tableRepository.updateAccountRequested(tableId, true);
    this.tableEventPublisher.notifyTableStatusChanged(table);

    return table;
  }
}

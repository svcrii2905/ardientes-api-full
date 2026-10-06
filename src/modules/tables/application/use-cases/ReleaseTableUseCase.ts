import { Table } from "../../domain/Table.ts";
import { TableRepository } from "../../domain/TableRepository.ts";
import { TableEventPublisher } from "../../domain/TableEventPublisher.ts";
import { NotFoundError, ValidationError } from "../../../../shared/domain/error.ts";

export class ReleaseTableUseCase {
  constructor(
    private readonly tableRepository: TableRepository,
    private readonly tableEventPublisher: TableEventPublisher
  ) {}

  async execute(tableId: number): Promise<Table> {
    const table = await this.tableRepository.findById(tableId);
    if (!table) {
      throw new NotFoundError(`Mesa con ID ${tableId} no encontrada`);
    }

    const pendingOrdersCount = await this.tableRepository.countPendingOrders(tableId);
    if (pendingOrdersCount > 0) {
      throw new ValidationError(
        `No se puede liberar la ${table.name} porque aún tiene ${pendingOrdersCount} pedido(s) pendiente(s) de pago`
      );
    }

    table.release();
    await this.tableRepository.updateStatus(tableId, "LIBRE");
    await this.tableRepository.updateAccountRequested(tableId, false);
    this.tableEventPublisher.notifyTableStatusChanged(table);

    return table;
  }
}

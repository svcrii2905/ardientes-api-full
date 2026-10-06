import { Table } from "../../domain/Table.ts";
import { TableRepository } from "../../domain/TableRepository.ts";
import { TableEventPublisher } from "../../domain/TableEventPublisher.ts";
import { NotFoundError, ValidationError } from "../../../../shared/domain/error.ts";

export interface TransferTableResult {
  sourceTable: Table;
  targetTable: Table;
}

export class TransferTableUseCase {
  constructor(
    private readonly tableRepository: TableRepository,
    private readonly tableEventPublisher: TableEventPublisher
  ) {}

  async execute(sourceTableId: number, targetTableId: number): Promise<TransferTableResult> {
    if (sourceTableId === targetTableId) {
      throw new ValidationError("La mesa origen y destino no pueden ser la misma");
    }

    const sourceTable = await this.tableRepository.findById(sourceTableId);
    if (!sourceTable) {
      throw new NotFoundError(`Mesa origen con ID ${sourceTableId} no encontrada`);
    }

    const targetTable = await this.tableRepository.findById(targetTableId);
    if (!targetTable) {
      throw new NotFoundError(`Mesa destino con ID ${targetTableId} no encontrada`);
    }

    if (!sourceTable.isOcupada()) {
      throw new ValidationError(`La mesa origen (${sourceTable.name}) no está OCUPADA`);
    }

    if (!targetTable.isLibre()) {
      throw new ValidationError(`La mesa destino (${targetTable.name}) ya está OCUPADA. Solo se puede trasladar a una mesa LIBRE.`);
    }

    const pendingCount = await this.tableRepository.countPendingOrders(sourceTableId);
    if (pendingCount === 0) {
      throw new ValidationError(`La mesa origen (${sourceTable.name}) no tiene pedidos activos para trasladar`);
    }

    // Ejecutar la transferencia transaccional atómica
    await this.tableRepository.transferOrders(sourceTableId, targetTableId);

    // Obtener los nuevos estados actualizados de ambas mesas
    const updatedSource = await this.tableRepository.findById(sourceTableId);
    const updatedTarget = await this.tableRepository.findById(targetTableId);

    if (updatedSource) {
      this.tableEventPublisher.notifyTableStatusChanged(updatedSource);
    }
    if (updatedTarget) {
      this.tableEventPublisher.notifyTableStatusChanged(updatedTarget);
    }

    return {
      sourceTable: updatedSource ?? sourceTable,
      targetTable: updatedTarget ?? targetTable,
    };
  }
}

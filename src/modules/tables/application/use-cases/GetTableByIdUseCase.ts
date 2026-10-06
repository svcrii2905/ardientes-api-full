import { Table } from "../../domain/Table.ts";
import { TableRepository } from "../../domain/TableRepository.ts";
import { NotFoundError } from "../../../../shared/domain/error.ts";

export class GetTableByIdUseCase {
  constructor(private readonly tableRepository: TableRepository) {}

  async execute(id: number): Promise<Table> {
    const table = await this.tableRepository.findById(id);
    if (!table) {
      throw new NotFoundError(`Mesa con ID ${id} no encontrada`);
    }
    return table;
  }
}

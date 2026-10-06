import { TableRepository, TableSummaryDTO } from "../../domain/TableRepository.ts";

export class GetTablesUseCase {
  constructor(private readonly tableRepository: TableRepository) {}

  async execute(): Promise<TableSummaryDTO[]> {
    return await this.tableRepository.findAllWithSummary();
  }
}

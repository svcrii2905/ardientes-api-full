import { Table, TableStatus } from "./Table.ts";

export interface TableSummaryDTO {
  table: Table;
  activeOrdersCount: number;
  totalPendingAmount: number;
}

export interface TableRepository {
  findAll(): Promise<Table[]>;
  findAllWithSummary(): Promise<TableSummaryDTO[]>;
  findById(id: number): Promise<Table | null>;
  findByNumber(number: number): Promise<Table | null>;
  updateStatus(id: number, status: TableStatus): Promise<void>;
  updateAccountRequested(id: number, requested: boolean): Promise<void>;
  countPendingOrders(tableId: number): Promise<number>;
  transferOrders(sourceTableId: number, targetTableId: number): Promise<void>;
}

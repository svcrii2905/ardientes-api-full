import { Table } from "./Table.ts";

export interface TableEventPublisher {
  notifyTableStatusChanged(table: Table): void;
}

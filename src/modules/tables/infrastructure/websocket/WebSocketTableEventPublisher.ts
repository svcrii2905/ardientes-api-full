import { Table } from "../../domain/Table.ts";
import { TableEventPublisher } from "../../domain/TableEventPublisher.ts";
import { webSocketHub } from "../../../../shared/infrastructure/websocket/WebSocketHub.ts";

export class WebSocketTableEventPublisher implements TableEventPublisher {
  notifyTableStatusChanged(table: Table): void {
    const payload = {
      tableId: table.id,
      number: table.number,
      name: table.name,
      status: table.status,
      accountRequested: table.accountRequested,
      updatedAt: table.updatedAt.toISOString(),
    };

    webSocketHub.broadcast("TABLE_STATUS_CHANGED", payload);
  }
}

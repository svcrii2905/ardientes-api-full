import { client } from "../../../shared/infrastructure/database.ts";
import { MySQLTableRepository } from "./mysql/MySQLTableRepository.ts";
import { WebSocketTableEventPublisher } from "./websocket/WebSocketTableEventPublisher.ts";
import { orderRepository, createOrderUseCase } from "../../orders/infrastructure/dependencies.ts";
import { GetTablesUseCase } from "../application/use-cases/GetTablesUseCase.ts";
import { GetTableByIdUseCase } from "../application/use-cases/GetTableByIdUseCase.ts";
import { GetTableOrdersUseCase } from "../application/use-cases/GetTableOrdersUseCase.ts";
import { CreateTableOrderUseCase } from "../application/use-cases/CreateTableOrderUseCase.ts";
import { RequestTableAccountUseCase } from "../application/use-cases/RequestTableAccountUseCase.ts";
import { ReleaseTableUseCase } from "../application/use-cases/ReleaseTableUseCase.ts";
import { TransferTableUseCase } from "../application/use-cases/TransferTableUseCase.ts";
import { TableController } from "./http/TableController.ts";

// ─── Repositories & Publishers ───────────────────────────────────────────────
export const tableRepository = new MySQLTableRepository(client);
export const tableEventPublisher = new WebSocketTableEventPublisher();

// ─── Use Cases ───────────────────────────────────────────────────────────────
export const getTablesUseCase = new GetTablesUseCase(tableRepository);
export const getTableByIdUseCase = new GetTableByIdUseCase(tableRepository);
export const getTableOrdersUseCase = new GetTableOrdersUseCase(tableRepository, orderRepository);
export const createTableOrderUseCase = new CreateTableOrderUseCase(tableRepository, createOrderUseCase, tableEventPublisher);
export const requestTableAccountUseCase = new RequestTableAccountUseCase(tableRepository, tableEventPublisher);
export const releaseTableUseCase = new ReleaseTableUseCase(tableRepository, tableEventPublisher);
export const transferTableUseCase = new TransferTableUseCase(tableRepository, tableEventPublisher);

// ─── Controller ──────────────────────────────────────────────────────────────
export const tableController = new TableController(
  getTablesUseCase,
  getTableByIdUseCase,
  getTableOrdersUseCase,
  createTableOrderUseCase,
  requestTableAccountUseCase,
  releaseTableUseCase,
  transferTableUseCase
);

import { MySQLOrderRepository } from "./mysql/MySQLOrderRepository.ts";
import { MySQLMenuToppingRuleRepository } from "./mysql/MySQLMenuToppingRuleRepository.ts";
import { MySQLCatalogQueryAdapter } from "./mysql/MySQLCatalogQueryAdapter.ts";
import { CreateOrderUseCase } from "../application/use-cases/CreateOrderUseCase.ts";
import { GetOrderByIdUseCase } from "../application/use-cases/GetOrderByIdUseCase.ts";
import { ListOrdersUseCase } from "../application/use-cases/ListOrdersUseCase.ts";
import { ChangeOrderStatusUseCase } from "../application/use-cases/ChangeOrderStatusUseCase.ts";
import { CancelOrderUseCase } from "../application/use-cases/CancelOrderUseCase.ts";
import { GetKitchenOrdersUseCase } from "../application/use-cases/GetKitchenOrdersUseCase.ts";
import { DispatchDeliveryOrderUseCase } from "../application/use-cases/DispatchDeliveryOrderUseCase.ts";
import { webSocketOrderEventPublisher } from "./websocket/WebSocketOrderEventPublisher.ts";
import { OrderController } from "./http/OrderController.ts";
import { authDependencies } from "../../auth/infrastructure/dependencies.ts";

// ─── Repositories ─────────────────────────────────────────────────────────────
export const orderRepository = new MySQLOrderRepository();
export const menuToppingRuleRepository = new MySQLMenuToppingRuleRepository();

// ─── Adapters (Anti-Corruption Layer) ─────────────────────────────────────────
export const catalogQueryAdapter = new MySQLCatalogQueryAdapter();

// ─── Use Cases ────────────────────────────────────────────────────────────────
export const createOrderUseCase = new CreateOrderUseCase(
  orderRepository,
  menuToppingRuleRepository,
  catalogQueryAdapter,
  webSocketOrderEventPublisher
);

export const getOrderByIdUseCase = new GetOrderByIdUseCase(orderRepository);
export const listOrdersUseCase = new ListOrdersUseCase(orderRepository);
export const changeOrderStatusUseCase = new ChangeOrderStatusUseCase(orderRepository, webSocketOrderEventPublisher);
export const cancelOrderUseCase = new CancelOrderUseCase(orderRepository, webSocketOrderEventPublisher);
export const getKitchenOrdersUseCase = new GetKitchenOrdersUseCase(orderRepository);
export const dispatchDeliveryOrderUseCase = new DispatchDeliveryOrderUseCase(
  orderRepository,
  authDependencies.listDriversUseCase,
  webSocketOrderEventPublisher
);

// ─── Controllers ──────────────────────────────────────────────────────────────
export const orderController = new OrderController(
  createOrderUseCase,
  getOrderByIdUseCase,
  listOrdersUseCase,
  changeOrderStatusUseCase,
  cancelOrderUseCase,
  getKitchenOrdersUseCase,
  dispatchDeliveryOrderUseCase
);

export const ordersDependencies = {
  orderController,
};

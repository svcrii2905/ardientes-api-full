import { MySQLPaymentMethodRepository } from "./mysql/MySQLPaymentMethodRepository.ts";
import { MySQLOrderPaymentRepository } from "./mysql/MySQLOrderPaymentRepository.ts";
import { MySQLPaymentOrderQueryAdapter } from "./mysql/MySQLPaymentOrderQueryAdapter.ts";
import { ListPaymentMethodsUseCase } from "../application/use-cases/ListPaymentMethodsUseCase.ts";
import { ProcessPaymentUseCase } from "../application/use-cases/ProcessPaymentUseCase.ts";
import { RevertPaymentUseCase } from "../application/use-cases/RevertPaymentUseCase.ts";
import { GetOrderPaymentsUseCase } from "../application/use-cases/GetOrderPaymentsUseCase.ts";
import { PaymentController } from "./http/PaymentController.ts";
import { transactionManager } from "../../../shared/infrastructure/database.ts";
import { tableEventPublisher, tableRepository } from "../../tables/infrastructure/dependencies.ts";

// ─── Repositories ─────────────────────────────────────────────────────────────
export const paymentMethodRepository = new MySQLPaymentMethodRepository();
export const orderPaymentRepository = new MySQLOrderPaymentRepository();

// ─── Adapters (Anti-Corruption Layer) ─────────────────────────────────────────
export const paymentOrderQueryAdapter = new MySQLPaymentOrderQueryAdapter();

// ─── Use Cases ────────────────────────────────────────────────────────────────
export const listPaymentMethodsUseCase = new ListPaymentMethodsUseCase(paymentMethodRepository);
export const processPaymentUseCase = new ProcessPaymentUseCase(
  orderPaymentRepository,
  paymentMethodRepository,
  paymentOrderQueryAdapter,
  transactionManager,
  tableEventPublisher,
  tableRepository
);
export const revertPaymentUseCase = new RevertPaymentUseCase(
  orderPaymentRepository,
  paymentOrderQueryAdapter
);
export const getOrderPaymentsUseCase = new GetOrderPaymentsUseCase(
  orderPaymentRepository,
  paymentOrderQueryAdapter
);

// ─── Controllers ──────────────────────────────────────────────────────────────
export const paymentController = new PaymentController(
  listPaymentMethodsUseCase,
  processPaymentUseCase,
  revertPaymentUseCase,
  getOrderPaymentsUseCase
);

export const paymentsDependencies = {
  paymentController,
  paymentMethodRepository,
  orderPaymentRepository,
};

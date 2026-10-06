import { MySQLCashRegisterRepository } from "./mysql/MySQLCashRegisterRepository.ts";
import { MySQLCashSessionRepository } from "./mysql/MySQLCashSessionRepository.ts";
import { MySQLCashTransactionRepository } from "./mysql/MySQLCashTransactionRepository.ts";
import { OpenCashSessionUseCase } from "../application/use-cases/OpenCashSessionUseCase.ts";
import { CloseCashSessionUseCase } from "../application/use-cases/CloseCashSessionUseCase.ts";
import { GetCurrentCashSessionUseCase } from "../application/use-cases/GetCurrentCashSessionUseCase.ts";
import { ListCashSessionsUseCase } from "../application/use-cases/ListCashSessionsUseCase.ts";
import { CreateCashTransactionUseCase } from "../application/use-cases/CreateCashTransactionUseCase.ts";
import { CashRegisterController } from "./http/CashRegisterController.ts";

// Repositories
export const cashRegisterRepository = new MySQLCashRegisterRepository();
export const cashSessionRepository = new MySQLCashSessionRepository();
export const cashTransactionRepository = new MySQLCashTransactionRepository();

// Use Cases
export const openCashSessionUseCase = new OpenCashSessionUseCase(
  cashSessionRepository,
  cashRegisterRepository
);
export const closeCashSessionUseCase = new CloseCashSessionUseCase(
  cashSessionRepository,
  cashTransactionRepository
);
export const getCurrentCashSessionUseCase = new GetCurrentCashSessionUseCase(
  cashSessionRepository
);
export const listCashSessionsUseCase = new ListCashSessionsUseCase(
  cashSessionRepository
);
export const createCashTransactionUseCase = new CreateCashTransactionUseCase(
  cashTransactionRepository,
  cashSessionRepository
);

// Controller
export const cashRegisterController = new CashRegisterController(
  openCashSessionUseCase,
  closeCashSessionUseCase,
  getCurrentCashSessionUseCase,
  listCashSessionsUseCase,
  createCashTransactionUseCase,
  cashTransactionRepository
);

export const cashRegisterDependencies = {
  cashRegisterController,
  cashRegisterRepository,
  cashSessionRepository,
  cashTransactionRepository,
};

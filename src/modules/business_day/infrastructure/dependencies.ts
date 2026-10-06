import { MySQLBusinessDayClosureRepository } from "./mysql/MySQLBusinessDayClosureRepository.ts";
import { GetBusinessDaySummaryUseCase } from "../application/use-cases/GetBusinessDaySummaryUseCase.ts";
import { CloseBusinessDayUseCase } from "../application/use-cases/CloseBusinessDayUseCase.ts";
import { BusinessDayController } from "./http/BusinessDayController.ts";
import { tableRepository, tableEventPublisher } from "../../tables/infrastructure/dependencies.ts";

export const mysqlBusinessDayClosureRepository = new MySQLBusinessDayClosureRepository();

export const getBusinessDaySummaryUseCase = new GetBusinessDaySummaryUseCase(
  mysqlBusinessDayClosureRepository
);

export const closeBusinessDayUseCase = new CloseBusinessDayUseCase(
  mysqlBusinessDayClosureRepository,
  tableRepository,
  tableEventPublisher
);

export const businessDayController = new BusinessDayController(
  getBusinessDaySummaryUseCase,
  closeBusinessDayUseCase
);

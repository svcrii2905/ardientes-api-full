import { MySQLCustomerRepository } from "./mysql/MySQLCustomerRepository.ts";
import { MySQLCustomerActivationRepository } from "./mysql/MySQLCustomerActivationRepository.ts";
import { SearchCustomerUseCase } from "../application/use-cases/SearchCustomerUseCase.ts";
import { CreateCustomerUseCase } from "../application/use-cases/CreateCustomerUseCase.ts";
import { RedeemPointsUseCase } from "../application/use-cases/RedeemPointsUseCase.ts";
import { GetCustomerLoyaltyUseCase } from "../application/use-cases/GetCustomerLoyaltyUseCase.ts";
import { RegisterCustomerUseCase } from "../application/use-cases/RegisterCustomerUseCase.ts";
import { CustomerLoginUseCase } from "../application/use-cases/CustomerLoginUseCase.ts";
import { GenerateActivationCodeUseCase } from "../application/use-cases/GenerateActivationCodeUseCase.ts";
import { ActivateCustomerUseCase } from "../application/use-cases/ActivateCustomerUseCase.ts";
import { CustomerController } from "./http/CustomerController.ts";
import { CustomerAuthController } from "./http/CustomerAuthController.ts";
import { transactionManager } from "../../../shared/infrastructure/database.ts";
import { passwordService, jwtService } from "../../auth/infrastructure/dependencies.ts";

export const customerRepository = new MySQLCustomerRepository();
export const customerActivationRepository = new MySQLCustomerActivationRepository();

export const searchCustomerUseCase = new SearchCustomerUseCase(customerRepository);
export const createCustomerUseCase = new CreateCustomerUseCase(customerRepository);
export const redeemPointsUseCase = new RedeemPointsUseCase(customerRepository, transactionManager);
export const getCustomerLoyaltyUseCase = new GetCustomerLoyaltyUseCase(customerRepository);

export const registerCustomerUseCase = new RegisterCustomerUseCase(
  customerRepository,
  passwordService,
  jwtService
);

export const customerLoginUseCase = new CustomerLoginUseCase(
  customerRepository,
  passwordService,
  jwtService
);

export const generateActivationCodeUseCase = new GenerateActivationCodeUseCase(
  customerRepository,
  customerActivationRepository
);

export const activateCustomerUseCase = new ActivateCustomerUseCase(
  customerRepository,
  customerActivationRepository,
  passwordService,
  jwtService
);

export const customerController = new CustomerController(
  searchCustomerUseCase,
  createCustomerUseCase,
  redeemPointsUseCase,
  getCustomerLoyaltyUseCase,
  customerRepository,
  generateActivationCodeUseCase
);

export const customerAuthController = new CustomerAuthController(
  registerCustomerUseCase,
  customerLoginUseCase,
  activateCustomerUseCase
);


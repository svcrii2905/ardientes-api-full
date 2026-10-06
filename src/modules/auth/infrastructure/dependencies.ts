import { MySQLUserRepository } from "./mysql/MySQLUserRepository.ts";
import { MySQLAuthVerificationRepository } from "./mysql/MySQLAuthVerificationRepository.ts";
import { BcryptPasswordService } from "./services/BcryptPasswordService.ts";
import { JoseJwtService } from "./services/JoseJwtService.ts";
import { NodemailerMailService } from "./services/NodemailerMailService.ts";

import { LoginUseCase } from "../application/use-cases/LoginUseCase.ts";
import { GetMeUseCase } from "../application/use-cases/GetMeUseCase.ts";
import { RequestPasswordResetUseCase } from "../application/use-cases/RequestPasswordResetUseCase.ts";
import { VerifyResetCodeUseCase } from "../application/use-cases/VerifyResetCodeUseCase.ts";
import { ResetPasswordUseCase } from "../application/use-cases/ResetPasswordUseCase.ts";
import { ChangePasswordUseCase } from "../application/use-cases/ChangePasswordUseCase.ts";
import { RequestEmailSetupUseCase } from "../application/use-cases/RequestEmailSetupUseCase.ts";
import { ConfirmEmailSetupUseCase } from "../application/use-cases/ConfirmEmailSetupUseCase.ts";
import { ListDriversUseCase } from "../application/use-cases/ListDriversUseCase.ts";

import { AuthController } from "./http/AuthController.ts";
import { UserController } from "./http/UserController.ts";

// ─── Repositorios & Servicios ────────────────────────────────────────────────
export const userRepository = new MySQLUserRepository();
export const verificationRepository = new MySQLAuthVerificationRepository();
export const passwordService = new BcryptPasswordService();
export const jwtService = new JoseJwtService();
export const mailService = new NodemailerMailService();

// ─── Casos de Uso ────────────────────────────────────────────────────────────
export const loginUseCase = new LoginUseCase(userRepository, passwordService, jwtService);
export const getMeUseCase = new GetMeUseCase(userRepository);

export const requestPasswordResetUseCase = new RequestPasswordResetUseCase(
  userRepository,
  verificationRepository,
  mailService
);

export const verifyResetCodeUseCase = new VerifyResetCodeUseCase(
  userRepository,
  verificationRepository,
  jwtService
);

export const resetPasswordUseCase = new ResetPasswordUseCase(
  userRepository,
  verificationRepository,
  jwtService,
  passwordService
);

export const changePasswordUseCase = new ChangePasswordUseCase(
  userRepository,
  passwordService,
  jwtService
);

export const requestEmailSetupUseCase = new RequestEmailSetupUseCase(
  userRepository,
  verificationRepository,
  mailService,
  passwordService
);

export const confirmEmailSetupUseCase = new ConfirmEmailSetupUseCase(
  userRepository,
  verificationRepository
);
export const listDriversUseCase = new ListDriversUseCase(userRepository);

// ─── Controladores ───────────────────────────────────────────────────────────
export const authController = new AuthController(
  loginUseCase,
  getMeUseCase,
  jwtService,
  requestPasswordResetUseCase,
  verifyResetCodeUseCase,
  resetPasswordUseCase,
  changePasswordUseCase,
  requestEmailSetupUseCase,
  confirmEmailSetupUseCase
);

export const userController = new UserController(listDriversUseCase);

export const authDependencies = {
  userRepository,
  verificationRepository,
  passwordService,
  jwtService,
  mailService,
  loginUseCase,
  getMeUseCase,
  requestPasswordResetUseCase,
  verifyResetCodeUseCase,
  resetPasswordUseCase,
  changePasswordUseCase,
  requestEmailSetupUseCase,
  confirmEmailSetupUseCase,
  authController,
  listDriversUseCase,
  userController,
};

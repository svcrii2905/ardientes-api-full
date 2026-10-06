import { Context } from "oak";
import { LoginUseCase } from "../../application/use-cases/LoginUseCase.ts";
import { GetMeUseCase } from "../../application/use-cases/GetMeUseCase.ts";
import { RequestPasswordResetUseCase } from "../../application/use-cases/RequestPasswordResetUseCase.ts";
import { VerifyResetCodeUseCase } from "../../application/use-cases/VerifyResetCodeUseCase.ts";
import { ResetPasswordUseCase } from "../../application/use-cases/ResetPasswordUseCase.ts";
import { ChangePasswordUseCase } from "../../application/use-cases/ChangePasswordUseCase.ts";
import { RequestEmailSetupUseCase } from "../../application/use-cases/RequestEmailSetupUseCase.ts";
import { ConfirmEmailSetupUseCase } from "../../application/use-cases/ConfirmEmailSetupUseCase.ts";
import { JwtService } from "../../domain/services/JwtService.ts";
import { UnauthorizedError, ValidationError } from "../../../../shared/domain/error.ts";
import { isStringWithin } from "../../../../common/validation.ts";

export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly jwtService: JwtService,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly verifyResetCodeUseCase: VerifyResetCodeUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly requestEmailSetupUseCase: RequestEmailSetupUseCase,
    private readonly confirmEmailSetupUseCase: ConfirmEmailSetupUseCase
  ) {}

  /**
   * POST /api/v1/auth/login
   * Autentica un usuario y emite un token JWT con sus roles y permisos.
   */
  async login(ctx: Context): Promise<void> {
    if (!ctx.request.hasBody) {
      throw new ValidationError("El cuerpo de la petición no puede estar vacío");
    }

    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    const payload = await body.value;

    const identifier = payload.identifier || payload.username || payload.email;
    const password = payload.password;
    if (!identifier || typeof identifier !== "string" || identifier.trim() === "") {
      throw new ValidationError("Se requiere un identificador válido");
    }
    if (!isStringWithin(identifier, 50)) {
      throw new ValidationError("El identificador no debe exceder 50 caracteres");
    }
    if (!password || typeof password !== "string" || password.trim() === "") {
      throw new ValidationError("Se requiere una contraseña válida");
    }
    if (!isStringWithin(password, 128)) {
      throw new ValidationError("La contraseña no debe exceder 128 caracteres");
    }

    const result = await this.loginUseCase.execute({
      identifier,
      password,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Autenticación exitosa",
      data: result,
    };
  }

  /**
   * GET /api/v1/auth/me
   * Retorna el perfil y permisos frescos del usuario autenticado vía Bearer Token.
   */
  async getMe(ctx: Context): Promise<void> {
    const authUser = (ctx.state as any).user;
    if (!authUser || !authUser.id) {
      throw new UnauthorizedError("Autenticación requerida");
    }

    const user = await this.getMeUseCase.execute(authUser.id);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: {
        user,
      },
    };
  }

  /**
   * POST /api/v1/auth/logout
   * Cierre semántico de sesión (stateless JWT).
   */
  logout(ctx: Context): void {
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Sesión cerrada exitosamente",
    };
  }

  /**
   * POST /api/v1/auth/forgot-password
   * Solicita el envío de un código de 6 dígitos para recuperación de contraseña.
   */
  async forgotPassword(ctx: Context): Promise<void> {
    if (!ctx.request.hasBody) {
      throw new ValidationError("El cuerpo de la petición no puede estar vacío");
    }

    const body = ctx.request.body({ type: "json", limit: 65_536 });
    const payload = await body.value;
    const email = payload.email;

    const ipAddress = ctx.request.ip;
    const result = await this.requestPasswordResetUseCase.execute({
      email,
      ipAddress,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: result.message,
    };
  }

  /**
   * POST /api/v1/auth/verify-reset-code
   * Valida el código de 6 dígitos y emite un resetToken exclusivo de corta duración.
   */
  async verifyResetCode(ctx: Context): Promise<void> {
    if (!ctx.request.hasBody) {
      throw new ValidationError("El cuerpo de la petición no puede estar vacío");
    }

    const body = ctx.request.body({ type: "json", limit: 65_536 });
    const payload = await body.value;
    const { email, code } = payload;

    const result = await this.verifyResetCodeUseCase.execute({ email, code });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: {
        resetToken: result.resetToken,
      },
    };
  }

  /**
   * POST /api/v1/auth/reset-password
   * Establece una nueva contraseña utilizando el resetToken exclusivo validado.
   */
  async resetPassword(ctx: Context): Promise<void> {
    if (!ctx.request.hasBody) {
      throw new ValidationError("El cuerpo de la petición no puede estar vacío");
    }

    const body = ctx.request.body({ type: "json", limit: 65_536 });
    const payload = await body.value;
    const { resetToken, newPassword } = payload;

    const result = await this.resetPasswordUseCase.execute({
      resetToken,
      newPassword,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: result.message,
    };
  }

  /**
   * POST /api/v1/auth/change-password
   * Cambia la contraseña de un usuario autenticado tras validar su contraseña actual.
   */
  async changePassword(ctx: Context): Promise<void> {
    const authUser = (ctx.state as any).user;
    if (!authUser || !authUser.id) {
      throw new UnauthorizedError("Autenticación requerida");
    }

    if (!ctx.request.hasBody) {
      throw new ValidationError("El cuerpo de la petición no puede estar vacío");
    }

    const body = ctx.request.body({ type: "json", limit: 65_536 });
    const payload = await body.value;
    const { currentPassword, newPassword } = payload;

    const result = await this.changePasswordUseCase.execute({
      userId: Number(authUser.id),
      currentPassword,
      newPassword,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: result.message,
      data: {
        accessToken: result.accessToken,
      },
    };
  }

  /**
   * POST /api/v1/auth/email-setup/request
   * Solicita vincular o cambiar el correo del usuario autenticado enviando un código al nuevo correo.
   */
  async requestEmailSetup(ctx: Context): Promise<void> {
    const authUser = (ctx.state as any).user;
    if (!authUser || !authUser.id) {
      throw new UnauthorizedError("Autenticación requerida");
    }

    if (!ctx.request.hasBody) {
      throw new ValidationError("El cuerpo de la petición no puede estar vacío");
    }

    const body = ctx.request.body({ type: "json", limit: 65_536 });
    const payload = await body.value;
    const { currentPassword, newEmail } = payload;

    const ipAddress = ctx.request.ip;
    const result = await this.requestEmailSetupUseCase.execute({
      userId: Number(authUser.id),
      currentPassword,
      newEmail,
      ipAddress,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: result.message,
    };
  }

  /**
   * POST /api/v1/auth/email-setup/confirm
   * Valida el código de verificación y asocia definitivamente el nuevo correo a la cuenta.
   */
  async confirmEmailSetup(ctx: Context): Promise<void> {
    const authUser = (ctx.state as any).user;
    if (!authUser || !authUser.id) {
      throw new UnauthorizedError("Autenticación requerida");
    }

    if (!ctx.request.hasBody) {
      throw new ValidationError("El cuerpo de la petición no puede estar vacío");
    }

    const body = ctx.request.body({ type: "json", limit: 65_536 });
    const payload = await body.value;
    const { email, code } = payload;

    const result = await this.confirmEmailSetupUseCase.execute({
      userId: Number(authUser.id),
      email,
      code,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: result.message,
      data: {
        user: result.user,
      },
    };
  }
}

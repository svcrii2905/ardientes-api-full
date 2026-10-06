import { UserRepository } from "../../domain/UserRepository.ts";
import { AuthVerificationRepository } from "../../domain/AuthVerificationRepository.ts";
import { JwtService } from "../../domain/services/JwtService.ts";
import { PasswordService } from "../../domain/services/PasswordService.ts";
import { UnauthorizedError, ValidationError } from "../../../../shared/domain/error.ts";

export interface ResetPasswordDTO {
  resetToken: string;
  newPassword: string;
}

export class ResetPasswordUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly verificationRepo: AuthVerificationRepository,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService
  ) {}

  async execute(dto: ResetPasswordDTO): Promise<{ message: string }> {
    const resetToken = dto.resetToken?.trim();
    const newPassword = dto.newPassword;

    if (!resetToken) {
      throw new ValidationError("Se requiere el token de restablecimiento de contraseña");
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.trim().length < 6) {
      throw new ValidationError("La nueva contraseña debe contener al menos 6 caracteres");
    }

    if (newPassword.length > 128) {
      throw new ValidationError("La nueva contraseña no debe exceder 128 caracteres");
    }

    // 1. Validar firma, vigencia y propósito exclusivo ("pwd_reset") del token
    let payload;
    try {
      payload = await this.jwtService.verifyResetToken(resetToken);
    } catch (_err) {
      throw new UnauthorizedError("El token de restablecimiento es inválido o ha expirado");
    }

    const userId = Number(payload.sub);
    const codeId = Number(payload.codeId);

    // 2. Verificar que el código asociado no haya sido consumido previamente
    const verification = await this.verificationRepo.findById(codeId);
    if (!verification || verification.isUsed()) {
      throw new ValidationError("Este código o enlace de recuperación ya fue utilizado previamente");
    }

    // 3. Invalidar inmediatamente el código de verificación marcándolo como usado
    await this.verificationRepo.markAsUsed(codeId);

    // 4. Generar hash seguro con bcryptjs (factor 10)
    const newPasswordHash = await this.passwordService.hash(newPassword);

    // 5. Actualizar la contraseña en la BD e incrementar token_version para invalidar sesiones activas
    await this.userRepository.updatePassword(userId, newPasswordHash);

    return {
      message: "Contraseña actualizada exitosamente. Inicia sesión con tus nuevas credenciales.",
    };
  }
}

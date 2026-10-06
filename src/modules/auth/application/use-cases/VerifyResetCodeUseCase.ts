import { UserRepository } from "../../domain/UserRepository.ts";
import { AuthVerificationRepository } from "../../domain/AuthVerificationRepository.ts";
import { JwtService } from "../../domain/services/JwtService.ts";
import { verifyCodeHash } from "../utils/codeGenerator.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";

export interface VerifyResetCodeDTO {
  email: string;
  code: string;
}

export class VerifyResetCodeUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly verificationRepo: AuthVerificationRepository,
    private readonly jwtService: JwtService
  ) {}

  async execute(dto: VerifyResetCodeDTO): Promise<{ resetToken: string }> {
    const email = dto.email?.trim().toLowerCase();
    const code = dto.code?.trim();

    if (!email || !code) {
      throw new ValidationError("Debe proporcionar el correo electrónico y el código de verificación");
    }

    if (!/^\d{6}$/.test(code)) {
      throw new ValidationError("El código debe contener exactamente 6 dígitos numéricos");
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.isActive) {
      throw new ValidationError("Código de verificación o correo no válido");
    }

    const verification = await this.verificationRepo.findLatestActive(
      user.id,
      email,
      "PASSWORD_RESET"
    );

    if (!verification || verification.isUsed() || verification.isExpired()) {
      throw new ValidationError(
        "El código ha expirado o ya fue utilizado. Por favor solicita uno nuevo."
      );
    }

    if (verification.hasExceededAttempts(3)) {
      throw new ValidationError(
        "Has superado el límite de 3 intentos permitidos. Solicita un nuevo código."
      );
    }

    const isMatch = await verifyCodeHash(code, verification.codeHash);
    if (!isMatch) {
      await this.verificationRepo.incrementAttempts(verification.id);
      const remaining = 2 - verification.attempts;
      const attemptMsg = remaining > 0 ? ` Te quedan ${remaining} intento(s).` : " Límite alcanzado.";
      throw new ValidationError(`Código de verificación incorrecto.${attemptMsg}`);
    }

    // Código verificado exitosamente -> Generar token exclusivo de reseteo (purpose: "pwd_reset", TTL: 10m)
    const resetToken = await this.jwtService.generateResetToken({
      userId: user.id,
      email: user.email,
      codeId: verification.id,
    });

    return { resetToken };
  }
}

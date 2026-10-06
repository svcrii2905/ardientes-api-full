import { UserRepository } from "../../domain/UserRepository.ts";
import { AuthVerificationRepository } from "../../domain/AuthVerificationRepository.ts";
import { SafeUserDTO } from "../../domain/User.ts";
import { verifyCodeHash } from "../utils/codeGenerator.ts";
import { UnauthorizedError, ValidationError } from "../../../../shared/domain/error.ts";

export interface ConfirmEmailSetupDTO {
  userId: number;
  email: string;
  code: string;
}

export class ConfirmEmailSetupUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly verificationRepo: AuthVerificationRepository
  ) {}

  async execute(dto: ConfirmEmailSetupDTO): Promise<{ message: string; user: SafeUserDTO }> {
    const { userId } = dto;
    const email = dto.email?.trim().toLowerCase();
    const code = dto.code?.trim();

    if (!userId) {
      throw new UnauthorizedError("Usuario no autenticado");
    }

    if (!email || !code) {
      throw new ValidationError("Debe proporcionar el correo electrónico y el código de verificación");
    }

    if (!/^\d{6}$/.test(code)) {
      throw new ValidationError("El código debe contener exactamente 6 dígitos numéricos");
    }

    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Usuario no encontrado o inactivo");
    }

    // 1. Buscar código activo para este usuario y correo destino
    const verification = await this.verificationRepo.findLatestActive(
      userId,
      email,
      "EMAIL_VERIFICATION"
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

    // 2. Validar coincidencia del hash del código
    const isMatch = await verifyCodeHash(code, verification.codeHash);
    if (!isMatch) {
      await this.verificationRepo.incrementAttempts(verification.id);
      const remaining = 2 - verification.attempts;
      const attemptMsg = remaining > 0 ? ` Te quedan ${remaining} intento(s).` : " Límite alcanzado.";
      throw new ValidationError(`Código de verificación incorrecto.${attemptMsg}`);
    }

    // 3. Marcar código como usado
    await this.verificationRepo.markAsUsed(verification.id);

    // 4. Verificar unicidad por seguridad concurrente
    const existing = await this.userRepository.findByEmail(email);
    if (existing && existing.id !== userId) {
      throw new ValidationError("El correo electrónico ya se encuentra registrado por otro usuario");
    }

    // 5. Guardar definitivamente el correo en users
    await this.userRepository.updateEmail(userId, email);

    // 6. Obtener el usuario actualizado
    const updatedUser = await this.userRepository.findById(userId);

    return {
      message: "Correo electrónico verificado y asociado exitosamente a tu cuenta.",
      user: updatedUser!.toSafeObject(),
    };
  }
}

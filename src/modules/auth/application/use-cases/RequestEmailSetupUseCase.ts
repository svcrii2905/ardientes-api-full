import { UserRepository } from "../../domain/UserRepository.ts";
import { AuthVerificationRepository } from "../../domain/AuthVerificationRepository.ts";
import { MailService } from "../../domain/services/MailService.ts";
import { PasswordService } from "../../domain/services/PasswordService.ts";
import { generateSixDigitCode, hashVerificationCode } from "../utils/codeGenerator.ts";
import { UnauthorizedError, ValidationError } from "../../../../shared/domain/error.ts";

export interface RequestEmailSetupDTO {
  userId: number;
  currentPassword: string;
  newEmail: string;
  ipAddress?: string | null;
}

export class RequestEmailSetupUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly verificationRepo: AuthVerificationRepository,
    private readonly mailService: MailService,
    private readonly passwordService: PasswordService
  ) {}

  async execute(dto: RequestEmailSetupDTO): Promise<{ message: string }> {
    const { userId, currentPassword, ipAddress } = dto;
    const newEmail = dto.newEmail?.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!userId) {
      throw new UnauthorizedError("Usuario no autenticado");
    }

    if (!currentPassword || typeof currentPassword !== "string") {
      throw new ValidationError("Debe ingresar su contraseña actual para autorizar esta operación");
    }

    if (!newEmail || !emailRegex.test(newEmail)) {
      throw new ValidationError("Debe proporcionar una dirección de correo electrónico válida");
    }

    // 1. Obtener usuario autenticado de la base de datos
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Usuario no encontrado o inactivo");
    }

    // 2. Validar contraseña actual con hash bcrypt
    const isPasswordValid = await this.passwordService.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError("La contraseña actual ingresada es incorrecta");
    }

    // 3. Verificar si el correo ya pertenece a otro usuario registrado
    const existingWithEmail = await this.userRepository.findByEmail(newEmail);
    if (existingWithEmail && existingWithEmail.id !== userId) {
      throw new ValidationError("El correo electrónico ya se encuentra registrado por otro usuario");
    }

    // 4. Rate limiting: Máximo 3 solicitudes por usuario o correo en 15 minutos
    const recentRequests = await this.verificationRepo.countRecentRequests(userId, newEmail, 15);
    if (recentRequests >= 3) {
      throw new ValidationError(
        "Has realizado demasiadas solicitudes recientes. Por favor espera unos minutos antes de intentar de nuevo."
      );
    }

    // 5. Generar código de 6 dígitos y hash SHA-256
    const code = generateSixDigitCode();
    const codeHash = await hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // 6. Guardar código en auth_verification_codes con type 'EMAIL_VERIFICATION' y targetEmail = newEmail
    await this.verificationRepo.create({
      userId,
      type: "EMAIL_VERIFICATION",
      targetEmail: newEmail,
      codeHash,
      expiresAt,
      ipAddress: ipAddress ?? null,
    });

    // 7. Despachar correo de verificación al nuevo correo especificado
    await this.mailService.sendVerificationCode({
      to: newEmail,
      code,
      type: "EMAIL_VERIFICATION",
      recipientName: user.fullName,
    });

    return {
      message: `Código de verificación enviado a ${newEmail}. Por favor ingrésalo para completar la vinculación.`,
    };
  }
}

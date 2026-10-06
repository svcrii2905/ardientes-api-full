import { UserRepository } from "../../domain/UserRepository.ts";
import { AuthVerificationRepository } from "../../domain/AuthVerificationRepository.ts";
import { MailService } from "../../domain/services/MailService.ts";
import { generateSixDigitCode, hashVerificationCode } from "../utils/codeGenerator.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";

export interface RequestPasswordResetDTO {
  email: string;
  ipAddress?: string | null;
}

export class RequestPasswordResetUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly verificationRepo: AuthVerificationRepository,
    private readonly mailService: MailService
  ) {}

  async execute(dto: RequestPasswordResetDTO): Promise<{ message: string }> {
    const email = dto.email?.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      throw new ValidationError("Debe proporcionar una dirección de correo electrónico válida");
    }

    // Rate limiting: Máximo 3 solicitudes por correo en una ventana de 15 minutos
    const recentRequests = await this.verificationRepo.countRecentRequests(null, email, 15);
    if (recentRequests >= 3) {
      throw new ValidationError(
        "Has realizado demasiadas solicitudes recientes. Por favor espera unos minutos antes de intentar de nuevo."
      );
    }

    const genericSuccessMessage =
      "Si el correo electrónico está registrado en el sistema, recibirás un código de verificación en breve.";

    // Buscar usuario por email
    const user = await this.userRepository.findByEmail(email);

    // Protección anti-enumeración de usuarios: Si no existe o está inactivo, responder con éxito ciego
    if (!user || !user.isActive) {
      // Retardo defensivo para prevenir timing attacks
      await new Promise((resolve) => setTimeout(resolve, 250));
      return { message: genericSuccessMessage };
    }

    // Generar código de 6 dígitos criptográfico y su hash SHA-256
    const code = generateSixDigitCode();
    const codeHash = await hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de vigencia

    // Persistir el código de verificación
    await this.verificationRepo.create({
      userId: user.id,
      type: "PASSWORD_RESET",
      targetEmail: email,
      codeHash,
      expiresAt,
      ipAddress: dto.ipAddress ?? null,
    });

    // Despachar correo electrónico de verificación
    await this.mailService.sendVerificationCode({
      to: email,
      code,
      type: "PASSWORD_RESET",
      recipientName: user.fullName,
    });

    return { message: genericSuccessMessage };
  }
}

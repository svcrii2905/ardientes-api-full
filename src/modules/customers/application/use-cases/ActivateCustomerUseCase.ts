import { CustomerRepository } from "../../domain/CustomerRepository.ts";
import { CustomerActivationRepository } from "../../domain/CustomerActivationRepository.ts";
import { PasswordService } from "../../../auth/domain/services/PasswordService.ts";
import { JwtService } from "../../../auth/domain/services/JwtService.ts";
import { verifyActivationCode } from "../utils/activationCodeGenerator.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";
import { Customer } from "../../domain/Customer.ts";

export interface ActivateCustomerDTO {
  phone: string;
  activationCode: string;
  password: string;
  email?: string | null;
}

export interface ActivateCustomerResultDTO {
  accessToken: string;
  customer: ReturnType<Customer["toSafeClientObject"]>;
  message: string;
}

export class ActivateCustomerUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly activationRepository: CustomerActivationRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService
  ) {}

  async execute(dto: ActivateCustomerDTO): Promise<ActivateCustomerResultDTO> {
    // 1. Validar y normalizar teléfono
    const cleanPhone = (dto.phone ?? "").replace(/[\s\-\(\)]/g, "").trim();
    if (!cleanPhone || cleanPhone.length < 7 || cleanPhone.length > 20) {
      throw new ValidationError("El teléfono debe contener entre 7 y 20 dígitos");
    }

    // 2. Validar código de activación
    const cleanCode = (dto.activationCode ?? "").trim();
    if (!cleanCode) {
      throw new ValidationError("El código de activación es obligatorio");
    }

    // 3. Validar contraseña
    const password = dto.password;
    if (!password || typeof password !== "string" || password.length < 6) {
      throw new ValidationError("La contraseña debe tener al menos 6 caracteres");
    }
    if (password.length > 128) {
      throw new ValidationError("La contraseña no debe exceder 128 caracteres");
    }

    // 4. Validar email si fue proporcionado
    let cleanEmail: string | null = null;
    if (dto.email && dto.email.trim()) {
      cleanEmail = dto.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 150) {
        throw new ValidationError("El formato de correo electrónico es inválido");
      }
    }

    // 5. Localizar al cliente en la base de datos
    const customer = await this.customerRepository.findByPhone(cleanPhone);
    if (!customer || !customer.isActive) {
      throw new ValidationError("Datos de activación inválidos o cliente no encontrado");
    }

    // 6. Verificar si ya tiene contraseña activa
    if (customer.passwordHash !== null && customer.passwordHash.trim() !== "") {
      throw new ValidationError("Esta cuenta ya se encuentra activada. Por favor inicia sesión.");
    }

    // 7. Buscar token de activación pendiente
    const token = await this.activationRepository.findLatestPendingByCustomerId(customer.id!);
    if (!token || token.isUsed() || token.isExpired()) {
      throw new ValidationError("Código de activación inválido o expirado. Solicita uno nuevo en Caja.");
    }

    // 8. Verificar bloqueo por límite de intentos
    if (token.isBlocked()) {
      throw new ValidationError("El código de activación ha sido bloqueado por superar el límite de 3 intentos. Solicita uno nuevo en Caja.");
    }

    // 9. Verificar coincidencia del hash del código
    const isCodeValid = await verifyActivationCode(cleanCode, token.codeHash);
    if (!isCodeValid) {
      const newAttempts = await this.activationRepository.incrementAttempts(token.id!);
      if (newAttempts >= token.maxAttempts) {
        throw new ValidationError("Código de activación incorrecto. Has superado el límite de 3 intentos y el código ha sido bloqueado. Solicita uno nuevo en Caja.");
      }
      const remaining = token.maxAttempts - newAttempts;
      throw new ValidationError(`Código de activación incorrecto. Te quedan ${remaining} intento(s).`);
    }

    // 10. Hashear contraseña con Bcrypt
    const hashedPassword = await this.passwordService.hash(password);

    // 11. Consumir atómicamente el token y activar cliente (concurrencia segura)
    const success = await this.activationRepository.atomicConsumeAndActivate(
      token.id!,
      customer.id!,
      hashedPassword,
      cleanEmail
    );

    if (!success) {
      throw new ValidationError("El código de activación ya fue utilizado o la cuenta ya fue activada.");
    }

    // 12. Obtener cliente actualizado para responder con datos frescos
    const updatedCustomer = await this.customerRepository.findById(customer.id!);
    if (!updatedCustomer) {
      throw new Error("Error interno al recuperar cliente activado");
    }

    // 13. Emitir JWT CUSTOMER independiente
    const accessToken = await this.jwtService.generateCustomerToken({
      customerId: updatedCustomer.id!,
      phone: updatedCustomer.phone,
      email: updatedCustomer.email ?? null,
      fullName: updatedCustomer.fullName,
      tokenVersion: updatedCustomer.tokenVersion,
    });

    return {
      accessToken,
      customer: updatedCustomer.toSafeClientObject(),
      message: "¡Cuenta activada exitosamente! Tus puntos y pedidos han sido vinculados correctamente.",
    };
  }
}

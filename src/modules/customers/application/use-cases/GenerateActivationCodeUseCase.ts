import { CustomerRepository } from "../../domain/CustomerRepository.ts";
import { CustomerActivationRepository } from "../../domain/CustomerActivationRepository.ts";
import { CustomerActivationToken } from "../../domain/CustomerActivationToken.ts";
import { generateActivationCode, hashActivationCode } from "../utils/activationCodeGenerator.ts";
import { NotFoundError, ValidationError } from "../../../../shared/domain/error.ts";

export interface GenerateActivationCodeDTO {
  customerId: number;
  createdBy: number;
}

export interface GenerateActivationCodeResultDTO {
  success: boolean;
  customerId: number;
  customerName: string;
  phone: string;
  activationCode: string;
  expiresAt: string;
  message: string;
}

export class GenerateActivationCodeUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly activationRepository: CustomerActivationRepository
  ) {}

  async execute(dto: GenerateActivationCodeDTO): Promise<GenerateActivationCodeResultDTO> {
    const { customerId, createdBy } = dto;

    if (!Number.isInteger(customerId) || customerId <= 0) {
      throw new ValidationError("ID de cliente inválido");
    }

    // 1. Validar customer existente
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError(`Cliente con ID ${customerId} no encontrado`);
    }

    // 2. Validar customer activo
    if (!customer.isActive) {
      throw new ValidationError("No se puede generar código de activación para un cliente inactivo");
    }

    // 3. Rechazar clientes que ya tengan cuenta activa
    if (customer.passwordHash !== null && customer.passwordHash.trim() !== "") {
      throw new ValidationError("El cliente ya cuenta con una cuenta web activa. Debe iniciar sesión en el portal.");
    }

    // 4. Invalidar códigos anteriores pendientes para este cliente
    await this.activationRepository.invalidatePreviousPending(customerId);

    // 5. Generar código criptográficamente seguro y calcular su hash
    const rawCode = generateActivationCode();
    const codeHash = await hashActivationCode(rawCode);

    // 6. Expiración de 24 horas
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // 7. Guardar únicamente el hash en la base de datos
    const token = new CustomerActivationToken({
      customerId,
      codeHash,
      expiresAt,
      attempts: 0,
      maxAttempts: 3,
      usedAt: null,
      createdBy,
      createdAt: new Date(),
    });
    await this.activationRepository.save(token);

    // 8. Retornar el código UNA SOLA VEZ al colaborador autorizado
    return {
      success: true,
      customerId: customer.id!,
      customerName: customer.fullName,
      phone: customer.phone,
      activationCode: rawCode,
      expiresAt: expiresAt.toISOString(),
      message: "Código de activación generado exitosamente. Entrégalo al cliente para vincular su cuenta.",
    };
  }
}

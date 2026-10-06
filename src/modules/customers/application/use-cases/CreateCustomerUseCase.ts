import { Customer } from "../../domain/Customer.ts";
import { CustomerRepository } from "../../domain/CustomerRepository.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";

export interface CreateCustomerDTO {
  fullName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  birthDate?: string | null;
}

export class CreateCustomerUseCase {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(dto: CreateCustomerDTO): Promise<Customer> {
    const cleanPhone = (dto.phone ?? "").trim();
    if (!cleanPhone) {
      throw new ValidationError("El teléfono del cliente es obligatorio");
    }

    const cleanName = (dto.fullName ?? "").trim();
    if (!cleanName) {
      throw new ValidationError("El nombre del cliente es obligatorio");
    }

    const existing = await this.customerRepository.findByPhone(cleanPhone);
    if (existing) {
      throw new ValidationError(`Ya existe un cliente registrado con el teléfono '${cleanPhone}'`);
    }

    const customer = new Customer(
      null,
      cleanName,
      cleanPhone,
      dto.email?.trim() || null,
      dto.address?.trim() || null,
      0, // Puntos iniciales
      0, // Total pedidos
      0, // Total gastado
      dto.birthDate ? new Date(dto.birthDate) : null,
      true,
      new Date()
    );

    return await this.customerRepository.save(customer);
  }
}

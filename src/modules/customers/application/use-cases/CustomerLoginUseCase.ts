import { Customer } from "../../domain/Customer.ts";
import { CustomerRepository } from "../../domain/CustomerRepository.ts";
import { PasswordService } from "../../../auth/domain/services/PasswordService.ts";
import { JwtService } from "../../../auth/domain/services/JwtService.ts";
import { UnauthorizedError, ValidationError } from "../../../../shared/domain/error.ts";

export interface CustomerLoginDTO {
  identifier: string; // teléfono o correo
  password: string;
}

export interface CustomerLoginResultDTO {
  accessToken: string;
  customer: ReturnType<Customer["toSafeClientObject"]>;
}

export class CustomerLoginUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService
  ) {}

  async execute(dto: CustomerLoginDTO): Promise<CustomerLoginResultDTO> {
    const rawIdentifier = (dto.identifier ?? "").trim();
    const password = dto.password;

    if (!rawIdentifier || !password) {
      throw new ValidationError("Debe proporcionar teléfono o correo y contraseña");
    }

    // 1. Determinar si busca por email o por teléfono
    let customer: Customer | null = null;
    if (rawIdentifier.includes("@")) {
      customer = await this.customerRepository.findByEmail(rawIdentifier.toLowerCase());
    } else {
      const cleanPhone = rawIdentifier.replace(/[\s\-\(\)]/g, "");
      customer = await this.customerRepository.findByPhone(cleanPhone);
    }

    // 2. Validación genérica anti-enumeración de clientes
    if (!customer || !customer.isActive) {
      throw new UnauthorizedError("Credenciales de acceso inválidas");
    }

    // 3. Si el cliente existe en Caja pero nunca ha creado su cuenta online (passwordHash es nulo)
    if (!customer.passwordHash || customer.passwordHash.trim() === "") {
      throw new UnauthorizedError(
        "Aún no has activado tu cuenta online. Por favor regístrate para vincular tus puntos e historial."
      );
    }

    // 4. Comparar contraseña con Bcrypt
    const isPasswordValid = await this.passwordService.compare(password, customer.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Credenciales de acceso inválidas");
    }

    // 5. Actualizar last_login_at en la tabla `customers`
    try {
      await this.customerRepository.updateLastLogin(customer.id!);
    } catch (_err) {
      // Fallo no bloqueante
    }

    // 6. Generar JWT exclusivo de CLIENTE (con userType: CUSTOMER)
    const accessToken = await this.jwtService.generateCustomerToken({
      customerId: customer.id!,
      phone: customer.phone,
      email: customer.email,
      fullName: customer.fullName,
      tokenVersion: customer.tokenVersion ?? 1,
    });

    return {
      accessToken,
      customer: customer.toSafeClientObject(),
    };
  }
}

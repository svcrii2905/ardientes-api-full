import { Customer } from "../../domain/Customer.ts";
import { CustomerRepository } from "../../domain/CustomerRepository.ts";
import { PasswordService } from "../../../auth/domain/services/PasswordService.ts";
import { JwtService } from "../../../auth/domain/services/JwtService.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";

export interface RegisterCustomerDTO {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  address?: string | null;
}

export interface RegisterCustomerResultDTO {
  accessToken: string;
  customer: ReturnType<Customer["toSafeClientObject"]>;
  message: string;
  isExistingLinked: boolean;
}

export class RegisterCustomerUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService
  ) {}

  async execute(dto: RegisterCustomerDTO): Promise<RegisterCustomerResultDTO> {
    // 1. Validar nombre completo
    const cleanFullName = (dto.fullName ?? "").trim();
    if (!cleanFullName || cleanFullName.length < 2) {
      throw new ValidationError("El nombre completo debe tener al menos 2 caracteres");
    }
    if (cleanFullName.length > 100) {
      throw new ValidationError("El nombre completo no debe exceder 100 caracteres");
    }

    // 2. Validar y normalizar teléfono
    const cleanPhone = (dto.phone ?? "").replace(/[\s\-\(\)]/g, "").trim();
    if (!cleanPhone || cleanPhone.length < 7 || cleanPhone.length > 20) {
      throw new ValidationError("El teléfono debe contener entre 7 y 20 dígitos");
    }
    if (!/^\+?[0-9]{7,20}$/.test(cleanPhone)) {
      throw new ValidationError("El formato de teléfono no es válido (solo dígitos)");
    }

    // 3. Validar y normalizar correo electrónico
    const cleanEmail = (dto.email ?? "").trim().toLowerCase();
    if (!cleanEmail) {
      throw new ValidationError("El correo electrónico es obligatorio");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 150) {
      throw new ValidationError("El formato de correo electrónico es inválido");
    }

    // 4. Validar contraseña
    const password = dto.password;
    if (!password || typeof password !== "string" || password.length < 6) {
      throw new ValidationError("La contraseña debe tener al menos 6 caracteres");
    }
    if (password.length > 128) {
      throw new ValidationError("La contraseña no debe exceder 128 caracteres");
    }

    // 5. Hashear contraseña usando Bcrypt seguro
    const hashedPassword = await this.passwordService.hash(password);

    // 6. Localizar clientes existentes en la tabla `customers`
    const customerByPhone = await this.customerRepository.findByPhone(cleanPhone);
    const customerByEmail = await this.customerRepository.findByEmail(cleanEmail);

    let savedCustomer: Customer;
    let isExistingLinked = false;

    if (customerByPhone) {
      if (customerByPhone.passwordHash !== null && customerByPhone.passwordHash.trim() !== "") {
        throw new ValidationError("Ya existe una cuenta activa con este teléfono. Por favor inicia sesión.");
      }
      throw new ValidationError(
        "Este número de teléfono ya está registrado en nuestro punto de venta. Para activar tu cuenta web y conservar tus puntos, utiliza el Código de Activación entregado en Caja."
      );
    } else if (customerByEmail) {
      if (customerByEmail.passwordHash !== null && customerByEmail.passwordHash.trim() !== "") {
        throw new ValidationError("Ya existe una cuenta activa con este correo electrónico. Por favor inicia sesión.");
      }
      throw new ValidationError(
        "Este correo electrónico ya se encuentra registrado en nuestro punto de venta. Para activar tu cuenta, utiliza el Código de Activación entregado en Caja."
      );
    } else {
      // Cliente totalmente nuevo
      const newCustomer = new Customer(
        null,
        cleanFullName,
        cleanPhone,
        cleanEmail,
        dto.address ? dto.address.trim() : null,
        0, // loyaltyPoints inicial
        0, // totalOrders inicial
        0, // totalSpent inicial
        null, // birthDate
        true, // isActive
        new Date(),
        hashedPassword,
        1, // tokenVersion
        false, // emailVerified
        null // lastLoginAt
      );

      savedCustomer = await this.customerRepository.save(newCustomer);
    }

    // 7. Generar JWT exclusivo de sesión de cliente
    const accessToken = await this.jwtService.generateCustomerToken({
      customerId: savedCustomer.id!,
      phone: savedCustomer.phone,
      email: savedCustomer.email,
      fullName: savedCustomer.fullName,
      tokenVersion: savedCustomer.tokenVersion ?? 1,
    });

    return {
      accessToken,
      customer: savedCustomer.toSafeClientObject(),
      message: isExistingLinked
        ? "Cuenta vinculada exitosamente con tu historial y puntos de Ardientes"
        : "Registro de cliente completado exitosamente",
      isExistingLinked,
    };
  }
}

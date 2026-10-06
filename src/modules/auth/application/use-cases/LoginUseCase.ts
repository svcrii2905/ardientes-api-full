import { UserRepository } from "../../domain/UserRepository.ts";
import { PasswordService } from "../../domain/services/PasswordService.ts";
import { JwtService } from "../../domain/services/JwtService.ts";
import { SafeUserDTO } from "../../domain/User.ts";
import { UnauthorizedError, ValidationError } from "../../../../shared/domain/error.ts";

export interface LoginDTO {
  identifier: string; // username o email
  password: string;
}

export interface LoginResultDTO {
  accessToken: string;
  user: SafeUserDTO;
}

export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService
  ) {}

  async execute(dto: LoginDTO): Promise<LoginResultDTO> {
    console.log(`[DIAGNÓSTICO LOGIN] Intento de login. Campo identificador enviado: ${dto.identifier}`);
    // 1. Validar entradas
    const identifier = dto.identifier?.trim();
    const password = dto.password;

    if (!identifier || !password) {
      throw new ValidationError("Debe proporcionar usuario/correo y contraseña");
    }

    // 2. Buscar usuario por username o email
    const user = identifier.includes("@")
      ? await this.userRepository.findByEmail(identifier)
      : await this.userRepository.findByUsername(identifier);

    // 3. Validación genérica para prevenir enumeración de usuarios
    if (!user || !user.isActive) {
      console.log(`[DIAGNÓSTICO LOGIN] Fallo: Usuario '${identifier}' no encontrado o inactivo.`);
      throw new UnauthorizedError("Credenciales de acceso inválidas");
    }
    
    console.log(`[DIAGNÓSTICO LOGIN] Usuario '${user.username}' encontrado. Verificando contraseña...`);

    // 4. Comparar contraseña con hash almacenado usando bcrypt
    const isPasswordValid = await this.passwordService.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      console.log(`[DIAGNÓSTICO LOGIN] Fallo: Contraseña incorrecta para el usuario '${user.username}'.`);
      throw new UnauthorizedError("Credenciales de acceso inválidas");
    }
    
    console.log(`[DIAGNÓSTICO LOGIN] Éxito: Contraseña verificada correctamente para '${user.username}'.`);

    // 5. Actualizar fecha de último login en base de datos
    try {
      await this.userRepository.updateLastLogin(user.id);
    } catch (_err) {
      // Fallo no bloqueante para el login
    }

    // 6. Generar JWT con roles, unión de permisos y versión del token
    const accessToken = await this.jwtService.generateToken({
      sub: String(user.id),
      username: user.username,
      fullName: user.fullName,
      roles: user.roles,
      permissions: user.permissions,
      tokenVersion: user.tokenVersion,
      purpose: "session",
    });

    // 7. Retornar DTO seguro (sin password_hash)
    return {
      accessToken,
      user: user.toSafeObject(),
    };
  }
}

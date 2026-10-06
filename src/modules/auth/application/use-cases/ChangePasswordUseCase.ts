import { UserRepository } from "../../domain/UserRepository.ts";
import { PasswordService } from "../../domain/services/PasswordService.ts";
import { JwtService } from "../../domain/services/JwtService.ts";
import { UnauthorizedError, ValidationError } from "../../../../shared/domain/error.ts";

export interface ChangePasswordDTO {
  userId: number;
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResultDTO {
  message: string;
  accessToken: string;
}

export class ChangePasswordUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService
  ) {}

  async execute(dto: ChangePasswordDTO): Promise<ChangePasswordResultDTO> {
    const { userId, currentPassword, newPassword } = dto;

    if (!userId) {
      throw new UnauthorizedError("Usuario no autenticado");
    }

    if (!currentPassword || typeof currentPassword !== "string") {
      throw new ValidationError("Debe ingresar su contraseña actual");
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.trim().length < 6) {
      throw new ValidationError("La nueva contraseña debe tener al menos 6 caracteres");
    }

    if (newPassword.length > 128) {
      throw new ValidationError("La nueva contraseña no debe exceder 128 caracteres");
    }

    if (currentPassword === newPassword) {
      throw new ValidationError("La nueva contraseña no puede ser idéntica a la actual");
    }

    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Usuario no encontrado o inactivo");
    }

    // Validar contraseña actual con hash bcrypt
    const isCurrentValid = await this.passwordService.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new UnauthorizedError("La contraseña actual ingresada es incorrecta");
    }

    // Hashear nueva contraseña
    const newPasswordHash = await this.passwordService.hash(newPassword);

    // Actualizar contraseña e incrementar token_version para invalidar sesiones en otros navegadores
    await this.userRepository.updatePassword(userId, newPasswordHash);

    // Obtener datos frescos del usuario con token_version actualizado
    const updatedUser = await this.userRepository.findById(userId);
    if (!updatedUser || !updatedUser.isActive) {
      throw new UnauthorizedError("Usuario no encontrado o inactivo");
    }

    // Generar nuevo JWT con la tokenVersion incrementada para mantener la sesión actual activa
    const accessToken = await this.jwtService.generateToken({
      sub: String(updatedUser.id),
      username: updatedUser.username,
      fullName: updatedUser.fullName,
      roles: updatedUser.roles,
      permissions: updatedUser.permissions,
      tokenVersion: updatedUser.tokenVersion,
      purpose: "session",
    });

    return {
      message: "Contraseña cambiada exitosamente.",
      accessToken,
    };
  }
}

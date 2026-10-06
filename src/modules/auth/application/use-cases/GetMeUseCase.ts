import { UserRepository } from "../../domain/UserRepository.ts";
import { SafeUserDTO } from "../../domain/User.ts";
import { UnauthorizedError } from "../../../../shared/domain/error.ts";

export class GetMeUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: number): Promise<SafeUserDTO> {
    if (!userId || isNaN(userId) || userId <= 0) {
      throw new UnauthorizedError("Identificador de usuario inválido");
    }

    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Usuario no encontrado o inactivo");
    }

    return user.toSafeObject();
  }
}

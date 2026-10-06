import { UserRepository } from "../../domain/UserRepository.ts";

export interface DriverDTO {
  id: number;
  username: string;
  fullName: string;
}

export class ListDriversUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(): Promise<DriverDTO[]> {
    const users = await this.userRepository.findByRole("DOMICILIARIO");

    // Mapear solo los datos necesarios para evitar exponer hashes, tokens, etc.
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
    }));
  }
}

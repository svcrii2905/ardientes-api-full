import { CashSession } from "../../domain/CashSession.ts";
import { CashSessionRepository } from "../../domain/CashSessionRepository.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";

export interface GetCurrentCashSessionDTO {
  registerId?: number;
  userId?: number;
}

export class GetCurrentCashSessionUseCase {
  constructor(private readonly cashSessionRepository: CashSessionRepository) {}

  async execute(dto: GetCurrentCashSessionDTO): Promise<CashSession | null> {
    if (!dto.registerId && !dto.userId) {
      throw new ValidationError("Debe especificar registerId o userId para consultar la sesión activa");
    }

    if (dto.registerId) {
      return await this.cashSessionRepository.findActiveByRegisterId(dto.registerId);
    }

    if (dto.userId) {
      return await this.cashSessionRepository.findActiveByUserId(dto.userId);
    }

    return null;
  }
}

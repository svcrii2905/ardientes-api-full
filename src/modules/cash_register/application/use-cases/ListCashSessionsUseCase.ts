import { CashSession } from "../../domain/CashSession.ts";
import { CashSessionRepository, CashSessionFilters } from "../../domain/CashSessionRepository.ts";

export interface ListCashSessionsDTO {
  registerId?: number;
  userId?: number;
  status?: string;
  limit?: number;
  offset?: number;
}

export class ListCashSessionsUseCase {
  constructor(private readonly cashSessionRepository: CashSessionRepository) {}

  async execute(dto: ListCashSessionsDTO = {}): Promise<CashSession[]> {
    const filters: CashSessionFilters = {
      registerId: dto.registerId,
      openedByUserId: dto.userId,
      status: dto.status,
      limit: dto.limit ?? 50,
      offset: dto.offset ?? 0,
    };

    return await this.cashSessionRepository.findAll(filters);
  }
}

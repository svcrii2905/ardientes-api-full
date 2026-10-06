import { BusinessDayClosureRepository, DaySummaryDTO } from "../../domain/BusinessDayClosureRepository.ts";

export class GetBusinessDaySummaryUseCase {
  constructor(private readonly closureRepository: BusinessDayClosureRepository) {}

  async execute(businessDate?: string): Promise<DaySummaryDTO> {
    const targetDate = businessDate || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
    return await this.closureRepository.getDaySummary(targetDate);
  }
}

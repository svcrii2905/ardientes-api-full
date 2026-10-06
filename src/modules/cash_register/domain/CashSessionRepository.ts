import { CashSession } from "./CashSession.ts";

export interface CashSessionFilters {
  registerId?: number;
  openedByUserId?: number;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface CashSessionRepository {
  save(session: CashSession): Promise<CashSession>;
  update(session: CashSession): Promise<CashSession>;
  findById(id: number): Promise<CashSession | null>;
  findActiveByRegisterId(registerId: number): Promise<CashSession | null>;
  findActiveByUserId(userId: number): Promise<CashSession | null>;
  findAll(filters?: CashSessionFilters): Promise<CashSession[]>;
}

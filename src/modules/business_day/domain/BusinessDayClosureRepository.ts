import { BusinessDayClosure } from "./BusinessDayClosure.ts";
import { QueryExecutor } from "../../../shared/infrastructure/database.ts";

export interface DaySummaryDTO {
  businessDate: string;
  isClosed: boolean;
  openedAt: Date | null;
  totalOrdersCount: number;
  totalSalesAmount: number;
  totalCashAmount: number;
  totalDigitalAmount: number;
  totalCardAmount: number;
  occupiedTablesCount: number;
  openCashSessionsCount: number;
  openCashSessionsDetails: Array<{ registerId: number; openedByUserId: number; openedByUserName: string }>;
  pendingOrdersCount: number;
  pendingOrdersDetails: Array<{ id: number; orderNumber: string; displayOrderNumber: string; tableId: number | null; status: string }>;
}

export interface BusinessDayClosureRepository {
  findByDate(businessDate: string, dbExecutor?: QueryExecutor): Promise<BusinessDayClosure | null>;
  save(closure: BusinessDayClosure, dbExecutor?: QueryExecutor): Promise<BusinessDayClosure>;
  getDaySummary(businessDate: string, dbExecutor?: QueryExecutor): Promise<DaySummaryDTO>;
  resetTablesToAvailable(dbExecutor?: QueryExecutor): Promise<void>;
}

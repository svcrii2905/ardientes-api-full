import { CashTransaction } from "./CashTransaction.ts";

export interface CashSessionTotals {
  totalDeposits: number;
  totalWithdrawals: number;
  totalOrderPaymentsCash: number;
  totalOrderPaymentsDigital: number;
  totalOrderPaymentsCard: number;
  totalExpectedCash: number;
}

export interface CashTransactionRepository {
  save(transaction: CashTransaction): Promise<CashTransaction>;
  findBySessionId(sessionId: number): Promise<CashTransaction[]>;
  calculateSessionTotals(sessionId: number, openingBalance: number): Promise<CashSessionTotals>;
}

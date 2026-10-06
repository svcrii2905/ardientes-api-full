import { Customer } from "./Customer.ts";
import { LoyaltyTransaction } from "./LoyaltyTransaction.ts";
import { QueryExecutor } from "../../../shared/infrastructure/database.ts";

export interface CustomerRepository {
  findById(id: number, executor?: QueryExecutor): Promise<Customer | null>;
  findByPhone(phone: string, executor?: QueryExecutor): Promise<Customer | null>;
  findByEmail(email: string, executor?: QueryExecutor): Promise<Customer | null>;
  search(term: string, limit?: number): Promise<Customer[]>;
  save(customer: Customer, executor?: QueryExecutor): Promise<Customer>;
  update(customer: Customer, executor?: QueryExecutor): Promise<Customer>;
  updateLastLogin(customerId: number, executor?: QueryExecutor): Promise<void>;
  addLoyaltyTransaction(transaction: LoyaltyTransaction, executor?: QueryExecutor): Promise<LoyaltyTransaction>;
  hasOrderAward(orderId: number, executor?: QueryExecutor): Promise<boolean>;
  getLoyaltyHistory(customerId: number, limit?: number): Promise<LoyaltyTransaction[]>;
}

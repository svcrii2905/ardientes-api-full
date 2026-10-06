import { PaymentMethod } from "./PaymentMethod.ts";
import { QueryExecutor } from "../../../shared/infrastructure/database.ts";

export interface PaymentMethodRepository {
  findAll(activeOnly?: boolean, executor?: QueryExecutor): Promise<PaymentMethod[]>;
  findById(id: number, executor?: QueryExecutor): Promise<PaymentMethod | null>;
  save(paymentMethod: PaymentMethod, executor?: QueryExecutor): Promise<PaymentMethod>;
}

import { CashRegister } from "./CashRegister.ts";

export interface CashRegisterRepository {
  findAll(activeOnly?: boolean): Promise<CashRegister[]>;
  findById(id: number): Promise<CashRegister | null>;
  save(register: CashRegister): Promise<CashRegister>;
}

import { CashRegister } from "../../domain/CashRegister.ts";
import { CashRegisterRepository } from "../../domain/CashRegisterRepository.ts";
import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

export class MySQLCashRegisterRepository implements CashRegisterRepository {
  async findAll(activeOnly?: boolean, dbExecutor?: QueryExecutor): Promise<CashRegister[]> {
    const exec = dbExecutor || client;
    let sql = "SELECT id, name, is_active FROM cash_registers";
    const params: any[] = [];
    if (activeOnly) {
      sql += " WHERE is_active = 1";
    }
    const rows = await exec.query(sql, params);
    return rows.map((row: any) => new CashRegister(
      row.id,
      row.name,
      row.is_active === 1
    ));
  }

  async findById(id: number, dbExecutor?: QueryExecutor): Promise<CashRegister | null> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      "SELECT id, name, is_active FROM cash_registers WHERE id = ? LIMIT 1",
      [id]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return new CashRegister(
      row.id,
      row.name,
      row.is_active === 1
    );
  }

  async save(register: CashRegister, dbExecutor?: QueryExecutor): Promise<CashRegister> {
    const exec = dbExecutor || client;
    if (register.id === null) {
      const result = await exec.execute(
        "INSERT INTO cash_registers (name, is_active) VALUES (?, ?)",
        [register.name, register.isActive ? 1 : 0]
      );
      return new CashRegister(
        result.lastInsertId!,
        register.name,
        register.isActive
      );
    } else {
      await exec.execute(
        "UPDATE cash_registers SET name = ?, is_active = ? WHERE id = ?",
        [register.name, register.isActive ? 1 : 0, register.id]
      );
      return register;
    }
  }
}

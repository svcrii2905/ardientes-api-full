import { PaymentMethod } from "../../domain/PaymentMethod.ts";
import { PaymentMethodType } from "../../domain/value-objects/PaymentMethodType.ts";
import { PaymentMethodRepository } from "../../domain/PaymentMethodRepository.ts";
import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

export class MySQLPaymentMethodRepository implements PaymentMethodRepository {
  async findAll(activeOnly: boolean = true, dbExecutor?: QueryExecutor): Promise<PaymentMethod[]> {
    const exec = dbExecutor || client;
    let query = `SELECT id, name, type, requires_reference, sort_order, is_active FROM payment_methods`;
    const params: any[] = [];

    if (activeOnly) {
      query += ` WHERE is_active = 1`;
    }

    query += ` ORDER BY sort_order ASC, name ASC`;

    const rows = await exec.query(query, params);

    return rows.map((row: any) => this.mapToDomain(row));
  }

  async findById(id: number, dbExecutor?: QueryExecutor): Promise<PaymentMethod | null> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      `SELECT id, name, type, requires_reference, sort_order, is_active 
       FROM payment_methods WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return null;

    return this.mapToDomain(rows[0]);
  }

  async save(paymentMethod: PaymentMethod, dbExecutor?: QueryExecutor): Promise<PaymentMethod> {
    const exec = dbExecutor || client;
    if (paymentMethod.id) {
      await exec.execute(
        `UPDATE payment_methods 
         SET name = ?, type = ?, requires_reference = ?, sort_order = ?, is_active = ?
         WHERE id = ?`,
        [
          paymentMethod.name,
          paymentMethod.type.value,
          paymentMethod.requiresReference ? 1 : 0,
          paymentMethod.sortOrder,
          paymentMethod.isActive ? 1 : 0,
          paymentMethod.id,
        ]
      );
      return paymentMethod;
    } else {
      const result = await exec.execute(
        `INSERT INTO payment_methods (name, type, requires_reference, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?)`,
        [
          paymentMethod.name,
          paymentMethod.type.value,
          paymentMethod.requiresReference ? 1 : 0,
          paymentMethod.sortOrder,
          paymentMethod.isActive ? 1 : 0,
        ]
      );

      return new PaymentMethod(
        result.lastInsertId!,
        paymentMethod.name,
        paymentMethod.type,
        paymentMethod.requiresReference,
        paymentMethod.sortOrder,
        paymentMethod.isActive
      );
    }
  }

  private mapToDomain(row: any): PaymentMethod {
    return new PaymentMethod(
      row.id,
      row.name,
      PaymentMethodType.create(row.type),
      row.requires_reference === 1,
      row.sort_order,
      row.is_active === 1
    );
  }
}

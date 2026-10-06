import { Customer } from "../../domain/Customer.ts";
import { LoyaltyTransaction, LoyaltyReason } from "../../domain/LoyaltyTransaction.ts";
import { CustomerRepository } from "../../domain/CustomerRepository.ts";
import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

export class MySQLCustomerRepository implements CustomerRepository {
  async findById(id: number, executor?: QueryExecutor): Promise<Customer | null> {
    const exec = executor ?? client;
    const rows = await exec.query(
      `SELECT * FROM customers WHERE id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByPhone(phone: string, executor?: QueryExecutor): Promise<Customer | null> {
    const exec = executor ?? client;
    const rows = await exec.query(
      `SELECT * FROM customers WHERE phone = ? LIMIT 1`,
      [phone.trim()]
    );
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByEmail(email: string, executor?: QueryExecutor): Promise<Customer | null> {
    const exec = executor ?? client;
    const rows = await exec.query(
      `SELECT * FROM customers WHERE email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async search(term: string, limit: number = 20): Promise<Customer[]> {
    const clean = term.trim();
    let query: string;
    let params: any[];

    if (!clean) {
      query = `SELECT * FROM customers WHERE is_active = 1 ORDER BY id DESC LIMIT ?`;
      params = [limit];
    } else {
      query = `SELECT * FROM customers 
               WHERE (phone LIKE ? OR full_name LIKE ? OR email LIKE ?)
               AND is_active = 1
               ORDER BY full_name ASC LIMIT ?`;
      params = [`%${clean}%`, `%${clean}%`, `%${clean}%`, limit];
    }

    const rows = await client.query(query, params);
    return rows.map((r: any) => this.mapToDomain(r));
  }

  async save(customer: Customer, executor?: QueryExecutor): Promise<Customer> {
    const exec = executor ?? client;
    const result = await exec.execute(
      `INSERT INTO customers (
        full_name, phone, email, address, password_hash, token_version, email_verified, last_login_at,
        loyalty_points, total_orders, total_spent, birth_date, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer.fullName,
        customer.phone,
        customer.email,
        customer.address,
        customer.passwordHash,
        customer.tokenVersion ?? 1,
        customer.emailVerified ? 1 : 0,
        customer.lastLoginAt ? customer.lastLoginAt.toISOString().slice(0, 19).replace("T", " ") : null,
        customer.loyaltyPoints,
        customer.totalOrders,
        customer.totalSpent,
        customer.birthDate ? customer.birthDate.toISOString().slice(0, 10) : null,
        customer.isActive ? 1 : 0,
      ]
    );

    return new Customer(
      result.lastInsertId!,
      customer.fullName,
      customer.phone,
      customer.email,
      customer.address,
      customer.loyaltyPoints,
      customer.totalOrders,
      customer.totalSpent,
      customer.birthDate,
      customer.isActive,
      new Date(),
      customer.passwordHash,
      customer.tokenVersion ?? 1,
      customer.emailVerified ?? false,
      customer.lastLoginAt ?? null
    );
  }

  async update(customer: Customer, executor?: QueryExecutor): Promise<Customer> {
    const exec = executor ?? client;
    await exec.execute(
      `UPDATE customers SET
        full_name = ?,
        phone = ?,
        email = ?,
        address = ?,
        password_hash = ?,
        token_version = ?,
        email_verified = ?,
        last_login_at = ?,
        loyalty_points = ?,
        total_orders = ?,
        total_spent = ?,
        birth_date = ?,
        is_active = ?
      WHERE id = ?`,
      [
        customer.fullName,
        customer.phone,
        customer.email,
        customer.address,
        customer.passwordHash,
        customer.tokenVersion ?? 1,
        customer.emailVerified ? 1 : 0,
        customer.lastLoginAt ? customer.lastLoginAt.toISOString().slice(0, 19).replace("T", " ") : null,
        customer.loyaltyPoints,
        customer.totalOrders,
        customer.totalSpent,
        customer.birthDate ? customer.birthDate.toISOString().slice(0, 10) : null,
        customer.isActive ? 1 : 0,
        customer.id,
      ]
    );
    return customer;
  }

  async updateLastLogin(customerId: number, executor?: QueryExecutor): Promise<void> {
    const exec = executor ?? client;
    const formatted = new Date().toISOString().slice(0, 19).replace("T", " ");
    await exec.execute(
      `UPDATE customers SET last_login_at = ? WHERE id = ?`,
      [formatted, customerId]
    );
  }

  async addLoyaltyTransaction(
    tx: LoyaltyTransaction,
    executor?: QueryExecutor
  ): Promise<LoyaltyTransaction> {
    const exec = executor ?? client;
    const result = await exec.execute(
      `INSERT INTO loyalty_transactions (
        customer_id, order_id, points_delta, reason, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        tx.customerId,
        tx.orderId,
        tx.pointsDelta,
        tx.reason,
        tx.notes,
        tx.createdBy,
      ]
    );

    return new LoyaltyTransaction(
      result.lastInsertId!,
      tx.customerId,
      tx.orderId,
      tx.pointsDelta,
      tx.reason,
      tx.notes,
      tx.createdBy,
      new Date()
    );
  }

  async hasOrderAward(orderId: number, executor?: QueryExecutor): Promise<boolean> {
    const exec = executor ?? client;
    const rows = await exec.query(
      `SELECT id FROM loyalty_transactions WHERE order_id = ? AND reason = 'COMPRA' LIMIT 1`,
      [orderId]
    );
    return rows.length > 0;
  }

  async getLoyaltyHistory(customerId: number, limit: number = 15): Promise<LoyaltyTransaction[]> {
    const rows = await client.query(
      `SELECT * FROM loyalty_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?`,
      [customerId, limit]
    );

    return rows.map((r: any) =>
      new LoyaltyTransaction(
        r.id,
        r.customer_id,
        r.order_id ?? null,
        r.points_delta,
        r.reason as LoyaltyReason,
        r.notes ?? null,
        r.created_by,
        r.created_at ? new Date(r.created_at) : null
      )
    );
  }

  private mapToDomain(row: any): Customer {
    return new Customer(
      row.id,
      row.full_name,
      row.phone,
      row.email ?? null,
      row.address ?? null,
      Number(row.loyalty_points ?? 0),
      Number(row.total_orders ?? 0),
      Number(row.total_spent ?? 0),
      row.birth_date ? new Date(row.birth_date) : null,
      row.is_active === 1,
      row.created_at ? new Date(row.created_at) : null,
      row.password_hash ?? null,
      Number(row.token_version ?? 1),
      row.email_verified === 1,
      row.last_login_at ? new Date(row.last_login_at) : null
    );
  }
}

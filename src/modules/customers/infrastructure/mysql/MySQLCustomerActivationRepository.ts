import { CustomerActivationToken } from "../../domain/CustomerActivationToken.ts";
import { CustomerActivationRepository } from "../../domain/CustomerActivationRepository.ts";
import { client, transactionManager } from "../../../../shared/infrastructure/database.ts";

export class MySQLCustomerActivationRepository implements CustomerActivationRepository {
  async save(token: CustomerActivationToken): Promise<CustomerActivationToken> {
    const result = await client.execute(
      `INSERT INTO customer_activation_tokens 
        (customer_id, code_hash, expires_at, attempts, max_attempts, used_at, created_by, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        token.customerId,
        token.codeHash,
        token.expiresAt,
        token.attempts,
        token.maxAttempts,
        token.usedAt,
        token.createdBy,
        token.createdAt,
      ]
    );

    if (result.lastInsertId) {
      token.setId(result.lastInsertId);
    }
    return token;
  }

  async findLatestPendingByCustomerId(customerId: number): Promise<CustomerActivationToken | null> {
    const rows = await client.query(
      `SELECT * FROM customer_activation_tokens 
       WHERE customer_id = ? AND used_at IS NULL 
       ORDER BY id DESC LIMIT 1`,
      [customerId]
    );

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async invalidatePreviousPending(customerId: number): Promise<void> {
    await client.execute(
      `UPDATE customer_activation_tokens 
       SET expires_at = NOW() 
       WHERE customer_id = ? AND used_at IS NULL AND expires_at > NOW()`,
      [customerId]
    );
  }

  async incrementAttempts(tokenId: number): Promise<number> {
    await client.execute(
      `UPDATE customer_activation_tokens 
       SET attempts = attempts + 1 
       WHERE id = ?`,
      [tokenId]
    );

    const rows = await client.query(
      `SELECT attempts FROM customer_activation_tokens WHERE id = ? LIMIT 1`,
      [tokenId]
    );
    if (rows.length === 0) return 0;
    return Number(rows[0].attempts);
  }

  async atomicConsumeAndActivate(
    tokenId: number,
    customerId: number,
    passwordHash: string,
    email?: string | null
  ): Promise<boolean> {
    return await transactionManager.runInTransaction(async (conn) => {
      // 1. Consumo condicional atómico del token
      const tokenResult = await conn.execute(
        `UPDATE customer_activation_tokens 
         SET used_at = NOW() 
         WHERE id = ? AND used_at IS NULL AND attempts < max_attempts AND expires_at > NOW()`,
        [tokenId]
      );

      if (tokenResult.affectedRows === 0) {
        return false;
      }

      // 2. Activación atómica del cliente en customers
      const customerResult = await conn.execute(
        `UPDATE customers 
         SET password_hash = ?, 
             token_version = 1, 
             email = COALESCE(?, email) 
         WHERE id = ? AND is_active = 1 AND (password_hash IS NULL OR password_hash = '')`,
        [passwordHash, email ? email.trim().toLowerCase() : null, customerId]
      );

      if (customerResult.affectedRows === 0) {
        throw new Error("El cliente ya se encuentra activo o no existe");
      }

      return true;
    });
  }

  private mapToDomain(row: any): CustomerActivationToken {
    return new CustomerActivationToken({
      id: Number(row.id),
      customerId: Number(row.customer_id),
      codeHash: String(row.code_hash),
      expiresAt: new Date(row.expires_at),
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      usedAt: row.used_at ? new Date(row.used_at) : null,
      createdBy: Number(row.created_by),
      createdAt: new Date(row.created_at),
    });
  }
}

import { client } from "../../../../shared/infrastructure/database.ts";
import {
  AuthVerificationCode,
  VerificationCodeType,
} from "../../domain/AuthVerificationCode.ts";
import {
  AuthVerificationRepository,
  CreateVerificationCodeDTO,
} from "../../domain/AuthVerificationRepository.ts";

interface AuthVerificationCodeRow {
  id: number;
  user_id: number;
  type: string;
  target_email: string;
  code_hash: string;
  expires_at: Date | string;
  attempts: number;
  used_at: Date | string | null;
  ip_address: string | null;
  created_at: Date | string;
}

export class MySQLAuthVerificationRepository implements AuthVerificationRepository {
  async create(dto: CreateVerificationCodeDTO): Promise<AuthVerificationCode> {
    const result = await client.execute(
      `INSERT INTO auth_verification_codes (user_id, type, target_email, code_hash, expires_at, attempts, ip_address)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [
        dto.userId,
        dto.type,
        dto.targetEmail,
        dto.codeHash,
        dto.expiresAt,
        dto.ipAddress ?? null,
      ]
    );

    const insertedId = result.lastInsertId!;
    return new AuthVerificationCode({
      id: insertedId,
      userId: dto.userId,
      type: dto.type,
      targetEmail: dto.targetEmail,
      codeHash: dto.codeHash,
      expiresAt: dto.expiresAt,
      attempts: 0,
      usedAt: null,
      ipAddress: dto.ipAddress ?? null,
      createdAt: new Date(),
    });
  }

  async findLatestActive(
    userId: number,
    targetEmail: string,
    type: VerificationCodeType
  ): Promise<AuthVerificationCode | null> {
    const rows = (await client.query(
      `SELECT id, user_id, type, target_email, code_hash, expires_at, attempts, used_at, ip_address, created_at
       FROM auth_verification_codes
       WHERE user_id = ? AND target_email = ? AND type = ? AND used_at IS NULL
       ORDER BY id DESC
       LIMIT 1`,
      [userId, targetEmail, type]
    )) as AuthVerificationCodeRow[];

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.mapToEntity(rows[0]);
  }

  async findById(id: number): Promise<AuthVerificationCode | null> {
    const rows = (await client.query(
      `SELECT id, user_id, type, target_email, code_hash, expires_at, attempts, used_at, ip_address, created_at
       FROM auth_verification_codes
       WHERE id = ?
       LIMIT 1`,
      [id]
    )) as AuthVerificationCodeRow[];

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.mapToEntity(rows[0]);
  }

  async incrementAttempts(id: number): Promise<void> {
    await client.execute(
      "UPDATE auth_verification_codes SET attempts = attempts + 1 WHERE id = ?",
      [id]
    );
  }

  async markAsUsed(id: number): Promise<void> {
    await client.execute(
      "UPDATE auth_verification_codes SET used_at = NOW() WHERE id = ?",
      [id]
    );
  }

  async countRecentRequests(
    userId: number | null,
    targetEmail: string,
    windowMinutes: number
  ): Promise<number> {
    const rows = (await client.query(
      `SELECT COUNT(*) as total
       FROM auth_verification_codes
       WHERE (target_email = ? OR (user_id = ? AND ? IS NOT NULL))
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [targetEmail, userId ?? 0, userId, windowMinutes]
    )) as { total: number }[];

    return rows && rows.length > 0 ? Number(rows[0].total) : 0;
  }

  private mapToEntity(row: AuthVerificationCodeRow): AuthVerificationCode {
    return new AuthVerificationCode({
      id: row.id,
      userId: row.user_id,
      type: row.type as VerificationCodeType,
      targetEmail: row.target_email,
      codeHash: row.code_hash,
      expiresAt: new Date(row.expires_at),
      attempts: row.attempts,
      usedAt: row.used_at ? new Date(row.used_at) : null,
      ipAddress: row.ip_address,
      createdAt: new Date(row.created_at),
    });
  }
}

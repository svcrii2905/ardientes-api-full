import { client } from "../../../../shared/infrastructure/database.ts";
import { User } from "../../domain/User.ts";
import { UserRepository } from "../../domain/UserRepository.ts";

interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role_id: number;
  is_active: number;
  token_version: number;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface RoleRow {
  id: number;
  name: string;
}

interface PermissionRow {
  code: string;
}

export class MySQLUserRepository implements UserRepository {
  async findByUsername(username: string): Promise<User | null> {
    const rows = (await client.query(
      `SELECT id, username, email, password_hash, full_name, role_id, is_active, token_version, last_login_at, created_at, updated_at
       FROM users
       WHERE username = ?
       LIMIT 1`,
      [username]
    )) as UserRow[];

    if (!rows || rows.length === 0) {
      return null;
    }

    return await this.hydrateUser(rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = (await client.query(
      `SELECT id, username, email, password_hash, full_name, role_id, is_active, token_version, last_login_at, created_at, updated_at
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    )) as UserRow[];

    if (!rows || rows.length === 0) {
      return null;
    }

    return await this.hydrateUser(rows[0]);
  }

  async findById(id: number): Promise<User | null> {
    const rows = (await client.query(
      `SELECT id, username, email, password_hash, full_name, role_id, is_active, token_version, last_login_at, created_at, updated_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [id]
    )) as UserRow[];

    if (!rows || rows.length === 0) {
      return null;
    }

    return await this.hydrateUser(rows[0]);
  }

  async listActiveUsers(): Promise<User[]> {
    const rows = (await client.query(
      `SELECT id, username, email, password_hash, full_name, role_id, is_active, token_version, last_login_at, created_at, updated_at
       FROM users
       WHERE is_active = 1
       ORDER BY full_name ASC`
    )) as UserRow[];

    const users: User[] = [];
    for (const row of rows) {
      users.push(await this.hydrateUser(row));
    }
    return users;
  }

  async findByRole(roleName: string): Promise<User[]> {
    const rows = (await client.query(
      `SELECT DISTINCT u.id, u.username, u.email, u.password_hash, u.full_name, u.role_id, u.is_active, u.token_version, u.last_login_at, u.created_at, u.updated_at
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       LEFT JOIN roles r_fallback ON u.role_id = r_fallback.id
       WHERE u.is_active = 1 
         AND (r.name = ? OR r_fallback.name = ?)
       ORDER BY u.full_name ASC`,
       [roleName, roleName]
    )) as UserRow[];

    const users: User[] = [];
    for (const row of rows) {
      users.push(await this.hydrateUser(row));
    }
    return users;
  }

  async updateLastLogin(userId: number): Promise<void> {
    await client.query(
      "UPDATE users SET last_login_at = NOW() WHERE id = ?",
      [userId]
    );
  }

  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    await client.query(
      "UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = NOW() WHERE id = ?",
      [passwordHash, userId]
    );
  }

  async updateEmail(userId: number, email: string): Promise<void> {
    await client.query(
      "UPDATE users SET email = ?, updated_at = NOW() WHERE id = ?",
      [email, userId]
    );
  }

  /**
   * Hidrata la entidad User obteniendo sus roles desde user_roles (y fallback users.role_id)
   * y calculando la unión deduplicada de todos los permisos asociados a sus roles.
   */
  private async hydrateUser(row: UserRow): Promise<User> {
    // 1. Obtener roles asignados en user_roles
    const assignedRoles = (await client.query(
      `SELECT r.id, r.name
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ?`,
      [row.id]
    )) as RoleRow[];

    const roleMap = new Map<number, string>();
    for (const r of assignedRoles) {
      roleMap.set(r.id, r.name);
    }

    // Fallback retrocompatible: Si users.role_id tiene valor y aún no está en user_roles
    if (row.role_id && !roleMap.has(row.role_id)) {
      const fallbackRoles = (await client.query(
        "SELECT id, name FROM roles WHERE id = ? LIMIT 1",
        [row.role_id]
      )) as RoleRow[];
      if (fallbackRoles.length > 0) {
        roleMap.set(fallbackRoles[0].id, fallbackRoles[0].name);
      }
    }

    const roleIds = Array.from(roleMap.keys());
    const roleNames = Array.from(roleMap.values());

    // 2. Obtener permisos asociados a los roles (Unión deduplicada)
    let permissions: string[] = [];
    if (roleIds.length > 0) {
      // Construir placeholders para IN (?, ?, ...)
      const placeholders = roleIds.map(() => "?").join(",");
      const permRows = (await client.query(
        `SELECT DISTINCT p.code
         FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_id IN (${placeholders})`,
        roleIds
      )) as PermissionRow[];

      permissions = permRows.map((p) => p.code);
    }

    return new User({
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      fullName: row.full_name,
      isActive: Boolean(row.is_active),
      tokenVersion: row.token_version ?? 1,
      roles: roleNames,
      permissions: permissions,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
    });
  }
}

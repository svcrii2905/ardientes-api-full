import { User } from "./User.ts";

export interface UserRepository {
  /**
   * Busca un usuario por su nombre de usuario (username), cargando roles y permisos
   */
  findByUsername(username: string): Promise<User | null>;

  /**
   * Busca un usuario por su correo electrónico (email), cargando roles y permisos
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Busca un usuario por su identificador único (id), cargando roles y permisos
   */
  findById(id: number): Promise<User | null>;

  /**
   * Lista todos los usuarios activos del sistema con sus roles y permisos
   */
  listActiveUsers(): Promise<User[]>;

  /**
   * Obtiene todos los usuarios activos que poseen un rol específico
   */
  findByRole(roleName: string): Promise<User[]>;

  /**
   * Actualiza la fecha/hora del último inicio de sesión
   */
  updateLastLogin(userId: number): Promise<void>;

  /**
   * Actualiza la contraseña del usuario e incrementa token_version para revocar sesiones anteriores
   */
  updatePassword(userId: number, passwordHash: string): Promise<void>;

  /**
   * Actualiza el correo electrónico verificado del usuario
   */
  updateEmail(userId: number, email: string): Promise<void>;
}

/**
 * Contrato para el servicio de hashing y verificación de contraseñas
 */
export interface PasswordService {
  /**
   * Genera un hash seguro para una contraseña en texto plano
   */
  hash(password: string): Promise<string>;

  /**
   * Compara una contraseña en texto plano contra un hash bcrypt
   */
  compare(password: string, hash: string): Promise<boolean>;
}

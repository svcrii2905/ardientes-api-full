/**
 * Carga útil (payload) contenida en el JWT emitido para sesión
 */
export interface AuthTokenPayload {
  sub: string;             // ID del usuario (string)
  username: string;        // Nombre de usuario
  fullName: string;        // Nombre completo
  roles: string[];         // Lista de nombres de roles activos
  permissions: string[];   // Lista de códigos de permisos activos (unión sin duplicados)
  tokenVersion?: number;   // Versión del token para revocación de sesiones
  purpose?: string;        // Propósito del token ("session" o undefined para retrocompatibilidad)
  iat?: number;            // Issued At timestamp (segundos)
  exp?: number;            // Expiration timestamp (segundos)
}

/**
 * Carga útil (payload) contenida en el token exclusivo de recuperación
 */
export interface ResetTokenPayload {
  sub: string;             // ID del usuario (string)
  email: string;           // Correo asociado
  codeId: number;          // ID del código de verificación validado
  purpose: "pwd_reset";    // Propósito restringido exclusivo
  iat?: number;
  exp?: number;
}

/**
 * Contrato para el servicio de generación y validación de tokens JWT
 */
export interface JwtService {
  /**
   * Genera y firma un token JWT con la información de sesión
   */
  generateToken(payload: Omit<AuthTokenPayload, "iat" | "exp">): Promise<string>;

  /**
   * Verifica la validez y firma de un token JWT, retornando su payload decodificado
   */
  verifyToken(token: string): Promise<AuthTokenPayload>;

  /**
   * Genera un token de corta duración (máx 10 minutos) exclusivo para resetear contraseña
   */
  generateResetToken(payload: { userId: number; email: string; codeId: number }): Promise<string>;

  /**
   * Verifica un token de recuperación asegurando que tenga purpose = "pwd_reset"
   */
  verifyResetToken(token: string): Promise<ResetTokenPayload>;

  /**
   * Genera un token exclusivo para sesión de CLIENTE (con userType: CUSTOMER)
   */
  generateCustomerToken(payload: {
    customerId: number;
    phone: string;
    email: string | null;
    fullName: string;
    tokenVersion: number;
  }): Promise<string>;

  /**
   * Valida un token de sesión de CLIENTE y extrae su payload tipado
   */
  verifyCustomerToken(token: string): Promise<CustomerTokenPayload>;
}

/**
 * Carga útil (payload) contenida en el token exclusivo de cliente
 */
export interface CustomerTokenPayload {
  sub: string;             // ID del cliente (string)
  userType: "CUSTOMER";    // Discriminador explícito
  customerId: number;      // ID numérico del cliente
  phone: string;           // Teléfono del cliente
  email: string | null;    // Correo del cliente
  fullName: string;        // Nombre completo
  tokenVersion: number;    // Versión para revocación de sesiones
  purpose: "customer_session";
  iat?: number;
  exp?: number;
}

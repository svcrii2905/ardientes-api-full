import { AuthVerificationCode, VerificationCodeType } from "./AuthVerificationCode.ts";

export interface CreateVerificationCodeDTO {
  userId: number;
  type: VerificationCodeType;
  targetEmail: string;
  codeHash: string;
  expiresAt: Date;
  ipAddress?: string | null;
}

export interface AuthVerificationRepository {
  /**
   * Crea un nuevo registro de código de verificación
   */
  create(dto: CreateVerificationCodeDTO): Promise<AuthVerificationCode>;

  /**
   * Busca el código más reciente no usado para un usuario, tipo y correo
   */
  findLatestActive(
    userId: number,
    targetEmail: string,
    type: VerificationCodeType
  ): Promise<AuthVerificationCode | null>;

  /**
   * Busca un código por su identificador primario
   */
  findById(id: number): Promise<AuthVerificationCode | null>;

  /**
   * Incrementa el contador de intentos fallidos
   */
  incrementAttempts(id: number): Promise<void>;

  /**
   * Marca el código como utilizado (usado)
   */
  markAsUsed(id: number): Promise<void>;

  /**
   * Cuenta solicitudes recientes para rate limiting (por usuario o correo destino)
   */
  countRecentRequests(
    userId: number | null,
    targetEmail: string,
    windowMinutes: number
  ): Promise<number>;
}

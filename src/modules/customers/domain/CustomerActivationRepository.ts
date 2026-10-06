import { CustomerActivationToken } from "./CustomerActivationToken.ts";

export interface CustomerActivationRepository {
  /**
   * Guarda un nuevo token de activación.
   */
  save(token: CustomerActivationToken): Promise<CustomerActivationToken>;

  /**
   * Obtiene el token de activación más reciente aún no consumido para un cliente.
   */
  findLatestPendingByCustomerId(customerId: number): Promise<CustomerActivationToken | null>;

  /**
   * Invalida (marca como expirados o revocados) los tokens pendientes anteriores para un cliente.
   */
  invalidatePreviousPending(customerId: number): Promise<void>;

  /**
   * Incrementa de forma atómica el contador de intentos fallidos.
   * Retorna el nuevo conteo de intentos.
   */
  incrementAttempts(tokenId: number): Promise<number>;

  /**
   * Consume atómicamente el token y activa el cliente en una sola transacción / actualización condicional.
   * Retorna true si se activó con éxito, o false si el token ya fue consumido por una petición concurrente.
   */
  atomicConsumeAndActivate(
    tokenId: number,
    customerId: number,
    passwordHash: string,
    email?: string | null
  ): Promise<boolean>;
}

import { ValidationError } from "../../../shared/domain/error.ts";

export class Customer {
  constructor(
    public readonly id: number | null,
    public fullName: string,
    public phone: string,
    public email: string | null = null,
    public address: string | null = null,
    public loyaltyPoints: number = 0,
    public totalOrders: number = 0,
    public totalSpent: number = 0,
    public birthDate: Date | null = null,
    public isActive: boolean = true,
    public readonly createdAt: Date | null = null,
    public passwordHash: string | null = null,
    public tokenVersion: number = 1,
    public emailVerified: boolean = false,
    public lastLoginAt: Date | null = null
  ) {
    this.validate();
  }

  public validate(): void {
    if (!this.fullName || this.fullName.trim().length === 0) {
      throw new ValidationError("El nombre del cliente no puede estar vacío");
    }
    if (!this.phone || this.phone.trim().length === 0) {
      throw new ValidationError("El teléfono del cliente no puede estar vacío");
    }
    // Normalizar teléfono eliminando espacios
    this.phone = this.phone.trim();
    if (this.loyaltyPoints < 0) {
      throw new ValidationError("Los puntos de fidelización no pueden ser negativos");
    }
    if (this.totalOrders < 0) {
      throw new ValidationError("El total de pedidos no puede ser negativo");
    }
    if (this.totalSpent < 0) {
      throw new ValidationError("El total gastado no puede ser negativo");
    }
  }

  /**
   * Indica si el cliente tiene al menos 1 recompensa disponible (10 puntos).
   */
  public canRedeemBurger(): boolean {
    return this.loyaltyPoints >= 10;
  }

  /**
   * Cantidad de recompensas (hamburguesas gratis) disponibles para canjear.
   */
  public getAvailableRewards(): number {
    return Math.floor(this.loyaltyPoints / 10);
  }

  /**
   * Puntos restantes necesarios para la próxima recompensa (sobre ciclo de 10).
   */
  public getPointsToNextReward(): number {
    const remainder = this.loyaltyPoints % 10;
    return remainder === 0 && this.loyaltyPoints > 0 ? 10 : 10 - remainder;
  }

  /**
   * Añade puntos válidos por una compra.
   */
  public addPoints(points: number): void {
    if (points <= 0) {
      throw new ValidationError("Los puntos a acumular deben ser mayores a cero");
    }
    this.loyaltyPoints += points;
  }

  /**
   * Redime puntos en bloques de 10 por cada recompensa.
   */
  public redeemRewards(rewardCount: number = 1): number {
    if (rewardCount <= 0) {
      throw new ValidationError("La cantidad de recompensas a redimir debe ser mayor a cero");
    }
    const pointsRequired = rewardCount * 10;
    if (this.loyaltyPoints < pointsRequired) {
      throw new ValidationError(
        `Puntos insuficientes. Requiere ${pointsRequired} puntos para ${rewardCount} recompensa(s), pero tiene ${this.loyaltyPoints}.`
      );
    }
    this.loyaltyPoints -= pointsRequired;
    return pointsRequired;
  }

  /**
   * Retorna una representación segura para el cliente (sin passwordHash).
   */
  public toSafeClientObject() {
    return {
      id: this.id,
      fullName: this.fullName,
      phone: this.phone,
      email: this.email,
      address: this.address,
      loyaltyPoints: this.loyaltyPoints,
      totalOrders: this.totalOrders,
      totalSpent: this.totalSpent,
      emailVerified: this.emailVerified,
      birthDate: this.birthDate,
      createdAt: this.createdAt,
      lastLoginAt: this.lastLoginAt,
    };
  }
}

export type LoyaltyReason = 'COMPRA' | 'CANJE' | 'AJUSTE' | 'CUMPLEAÑOS' | 'BONO';

export class LoyaltyTransaction {
  constructor(
    public readonly id: number | null,
    public readonly customerId: number,
    public readonly orderId: number | null,
    public readonly pointsDelta: number,
    public readonly reason: LoyaltyReason,
    public readonly notes: string | null,
    public readonly createdBy: number,
    public readonly createdAt: Date | null = null
  ) {}

  public isGain(): boolean {
    return this.pointsDelta > 0;
  }

  public isRedemption(): boolean {
    return this.pointsDelta < 0;
  }
}

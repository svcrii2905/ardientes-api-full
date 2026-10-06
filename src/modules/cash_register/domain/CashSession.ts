import { ValidationError } from "../../../shared/domain/error.ts";
import { CashSessionStatus } from "./value-objects/CashSessionStatus.ts";

/**
 * Entidad CashSession representa la sesión / turno de apertura y arqueo de una caja.
 * Invariantes de dominio:
 * - openedByUserId, registerId obligatorios.
 * - openingBalance debe ser >= 0.
 * - Cierre automático calcula el monto esperado, contado y discrepancia.
 */
export class CashSession {
  constructor(
    public readonly id: number | null,
    public readonly openedByUserId: number,
    public closedByUserId: number | null,
    public readonly registerId: number,
    public status: CashSessionStatus,
    public readonly openingBalance: number,
    public closingBalanceExpected: number,
    public closingBalanceReal: number,
    public discrepancyAmount: number,
    public readonly notes: string | null,
    public discrepancyNotes: string | null,
    public readonly openedAt: Date | null,
    public closedAt: Date | null,
    public readonly openedByUserName?: string | null
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.openedByUserId || this.openedByUserId <= 0) {
      throw new ValidationError("La sesión requiere el ID del usuario que abre (openedByUserId)");
    }
    if (!this.registerId || this.registerId <= 0) {
      throw new ValidationError("La sesión requiere un ID de caja válido (registerId)");
    }
    if (typeof this.openingBalance !== "number" || isNaN(this.openingBalance) || this.openingBalance < 0) {
      throw new ValidationError("El saldo inicial de apertura no puede ser negativo");
    }
  }

  public isOpen(): boolean {
    return this.status.isOpen();
  }

  public isClosed(): boolean {
    return this.status.isClosed();
  }

  /**
   * Cierra la sesión de caja realizando el arqueo.
   * Calcula automáticamente:
   * - closingBalanceExpected = expectedBalance
   * - closingBalanceReal = realCounted
   * - discrepancyAmount = realCounted - expectedBalance
   */
  public close(
    closedByUserId: number,
    realCounted: number,
    expectedBalance: number,
    discrepancyNotes?: string
  ): void {
    if (!this.isOpen()) {
      throw new ValidationError("No se puede cerrar una sesión que no está ABIERTA");
    }
    if (!closedByUserId || closedByUserId <= 0) {
      throw new ValidationError("Se requiere el ID del usuario responsable del cierre (closedByUserId)");
    }
    if (typeof realCounted !== "number" || isNaN(realCounted) || realCounted < 0) {
      throw new ValidationError("El dinero contado en el arqueo no puede ser negativo");
    }

    this.closedByUserId = closedByUserId;
    this.closingBalanceExpected = Math.round(expectedBalance * 100) / 100;
    this.closingBalanceReal = Math.round(realCounted * 100) / 100;
    this.discrepancyAmount = Math.round((this.closingBalanceReal - this.closingBalanceExpected) * 100) / 100;
    this.discrepancyNotes = discrepancyNotes?.trim() ?? null;
    this.closedAt = new Date();
    this.status = this.status.transitionTo("CLOSED");
  }
}

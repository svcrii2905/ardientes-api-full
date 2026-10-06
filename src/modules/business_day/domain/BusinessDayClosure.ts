import { ValidationError } from "../../../shared/domain/error.ts";

export class BusinessDayClosure {
  constructor(
    public readonly id: number | null,
    public readonly businessDate: string,
    public readonly openedAt: Date,
    public readonly closedAt: Date,
    public readonly closedByUserId: number,
    public readonly totalOrdersCount: number,
    public readonly totalSalesAmount: number,
    public readonly totalCashAmount: number,
    public readonly totalDigitalAmount: number,
    public readonly totalCardAmount: number,
    public readonly notes: string | null = null,
    public readonly createdAt: Date | null = null
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.businessDate || !/^\d{4}-\d{2}-\d{2}$/.test(this.businessDate)) {
      throw new ValidationError("La fecha de negocio debe tener el formato YYYY-MM-DD");
    }
    if (!this.closedByUserId || this.closedByUserId <= 0) {
      throw new ValidationError("El ID del usuario responsable debe ser un entero positivo");
    }
    if (this.totalOrdersCount < 0) {
      throw new ValidationError("El total de pedidos no puede ser negativo");
    }
    if (this.totalSalesAmount < 0) {
      throw new ValidationError("El monto total de ventas no puede ser negativo");
    }
  }
}

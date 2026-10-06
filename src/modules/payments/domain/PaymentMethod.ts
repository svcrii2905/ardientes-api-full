import { ValidationError } from "../../../shared/domain/error.ts";
import { PaymentMethodType } from "./value-objects/PaymentMethodType.ts";

/**
 * Entidad PaymentMethod del catálogo de medios de pago.
 */
export class PaymentMethod {
  constructor(
    public readonly id: number | null,
    public name: string,
    public type: PaymentMethodType,
    public requiresReference: boolean,
    public sortOrder: number,
    public isActive: boolean
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new ValidationError("El nombre del método de pago no puede estar vacío");
    }
    if (this.sortOrder < 0) {
      throw new ValidationError("El orden de clasificación no puede ser negativo");
    }
  }

  public activate(): void {
    this.isActive = true;
  }

  public deactivate(): void {
    this.isActive = false;
  }
}

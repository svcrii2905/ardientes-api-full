import { ValidationError } from "../../../shared/domain/error.ts";

/**
 * Entidad CashRegister representa un terminal de caja física del restaurante.
 */
export class CashRegister {
  constructor(
    public readonly id: number | null,
    public name: string,
    public isActive: boolean
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new ValidationError("El nombre de la caja no puede estar vacío");
    }
  }

  public activate(): void {
    this.isActive = true;
  }

  public deactivate(): void {
    this.isActive = false;
  }
}

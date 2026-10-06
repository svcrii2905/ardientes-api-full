import { ValidationError } from "../../../shared/domain/error.ts";

export type MenuAvailability = 'UNIVERSITARIO' | 'ESPECIAL' | 'AMBOS';

export class Product {
  constructor(
    public readonly id: number | null,
    public categoryId: number,
    public sku: string,
    public name: string,
    public description: string | null,
    public priceUniversitario: number | null,
    public priceEspecial: number | null,
    public imageUrl: string | null,
    public hasToppings: boolean,
    public availableIn: MenuAvailability,
    public isActive: boolean
  ) {
    this.validate();
  }

  public validate() {
    if (!this.sku || this.sku.trim().length === 0) {
      throw new ValidationError("El SKU del producto no puede estar vacío");
    }
    if (!this.name || this.name.trim().length === 0) {
      throw new ValidationError("El nombre del producto no puede estar vacío");
    }
    if (this.priceUniversitario === null && this.priceEspecial === null) {
      throw new ValidationError("El producto debe tener al menos un precio (Universitario o Especial)");
    }
    if (this.priceUniversitario !== null && this.priceUniversitario < 0) {
      throw new ValidationError("El precio universitario no puede ser negativo");
    }
    if (this.priceEspecial !== null && this.priceEspecial < 0) {
      throw new ValidationError("El precio especial no puede ser negativo");
    }
  }

  public activate() {
    this.isActive = true;
  }

  public deactivate() {
    this.isActive = false;
  }
}

import { ValidationError } from "../../../shared/domain/error.ts";

export class Category {
  constructor(
    public readonly id: number | null,
    public name: string,
    public iconUrl: string | null,
    public sortOrder: number,
    public isActive: boolean
  ) {
    this.validate();
  }

  public validate() {
    if (!this.name || this.name.trim().length === 0) {
      throw new ValidationError("El nombre de la categoría no puede estar vacío");
    }
  }

  public activate() {
    this.isActive = true;
  }

  public deactivate() {
    this.isActive = false;
  }
}

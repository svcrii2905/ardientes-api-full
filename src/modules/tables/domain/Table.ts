import { ValidationError } from "../../../shared/domain/error.ts";

export type TableStatus = "LIBRE" | "OCUPADA";

export class Table {
  constructor(
    public readonly id: number,
    public readonly number: number,
    public readonly name: string,
    public status: TableStatus,
    public accountRequested: boolean = false,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.id || this.id < 1) {
      throw new ValidationError("El ID de la mesa debe ser un entero positivo");
    }
    if (!this.number || this.number < 1 || this.number > 7) {
      throw new ValidationError("El número de mesa debe estar entre 1 y 7");
    }
    if (this.status !== "LIBRE" && this.status !== "OCUPADA") {
      throw new ValidationError(`Estado de mesa '${this.status}' no válido. Solo se permiten 'LIBRE' y 'OCUPADA'`);
    }
  }

  public isLibre(): boolean {
    return this.status === "LIBRE";
  }

  public isOcupada(): boolean {
    return this.status === "OCUPADA";
  }

  public occupy(): void {
    this.status = "OCUPADA";
    this.updatedAt = new Date();
  }

  public requestAccount(): void {
    if (!this.isOcupada()) {
      throw new ValidationError("No se puede solicitar la cuenta de una mesa que está LIBRE");
    }
    this.accountRequested = true;
    this.updatedAt = new Date();
  }

  public release(): void {
    this.status = "LIBRE";
    this.accountRequested = false;
    this.updatedAt = new Date();
  }
}

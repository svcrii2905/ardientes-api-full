import { ValidationError } from "../../../../shared/domain/error.ts";

export type MenuTypeValue = "UNIVERSITARIO" | "ESPECIAL";

const VALID_MENU_TYPES: MenuTypeValue[] = ["UNIVERSITARIO", "ESPECIAL"];

export class MenuType {
  private constructor(public readonly value: MenuTypeValue) {}

  static create(value: string): MenuType {
    const normalized = value?.toUpperCase() as MenuTypeValue;
    if (!VALID_MENU_TYPES.includes(normalized)) {
      throw new ValidationError(
        `Tipo de menú inválido: '${value}'. Los valores válidos son: ${VALID_MENU_TYPES.join(", ")}`
      );
    }
    return new MenuType(normalized);
  }

  static fromDB(value: string): MenuType {
    return new MenuType(value as MenuTypeValue);
  }

  isUniversitario(): boolean {
    return this.value === "UNIVERSITARIO";
  }

  isEspecial(): boolean {
    return this.value === "ESPECIAL";
  }

  toString(): string {
    return this.value;
  }
}

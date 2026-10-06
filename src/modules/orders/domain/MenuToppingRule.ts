import { MenuTypeValue } from "./value-objects/MenuType.ts";

/**
 * Regla de límite de toppings por tipo de menú.
 * Cargada desde la tabla `menu_topping_rules` al crear un pedido.
 */
export class MenuToppingRule {
  constructor(
    public readonly id: number,
    public readonly menuType: MenuTypeValue,
    public readonly maxToppings: number | null, // null = sin límite
    public readonly allowFreeSelection: boolean,
    public readonly description: string | null
  ) {}

  /**
   * Verifica si la cantidad de toppings excede el límite para este menú.
   * Si maxToppings es null, no hay límite.
   */
  exceedsLimit(toppingCount: number): boolean {
    if (this.maxToppings === null) return false;
    return toppingCount > this.maxToppings;
  }

  getMaxDescription(): string {
    if (this.maxToppings === null) return "sin límite";
    return `máximo ${this.maxToppings}`;
  }
}

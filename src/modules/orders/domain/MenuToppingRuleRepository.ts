import { MenuToppingRule } from "./MenuToppingRule.ts";
import { MenuTypeValue } from "./value-objects/MenuType.ts";

/**
 * Puerto de salida para las reglas de toppings por menú.
 * Consultado en CreateOrderUseCase para validar límites de toppings.
 */
export interface MenuToppingRuleRepository {
  findByMenuType(menuType: MenuTypeValue): Promise<MenuToppingRule | null>;
  findAll(): Promise<MenuToppingRule[]>;
}

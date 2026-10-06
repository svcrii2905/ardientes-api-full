import { MenuToppingRule } from "../../domain/MenuToppingRule.ts";
import { MenuToppingRuleRepository } from "../../domain/MenuToppingRuleRepository.ts";
import { MenuTypeValue } from "../../domain/value-objects/MenuType.ts";
import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

export class MySQLMenuToppingRuleRepository implements MenuToppingRuleRepository {
  async findByMenuType(menuType: MenuTypeValue, dbExecutor?: QueryExecutor): Promise<MenuToppingRule | null> {
    const exec = dbExecutor || client;
    const query = `
      SELECT id, menu_type, max_toppings, allow_free_selection, description
      FROM menu_topping_rules
      WHERE menu_type = ?
      LIMIT 1
    `;
    const result = await exec.query(query, [menuType]);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findAll(dbExecutor?: QueryExecutor): Promise<MenuToppingRule[]> {
    const exec = dbExecutor || client;
    const query = `
      SELECT id, menu_type, max_toppings, allow_free_selection, description
      FROM menu_topping_rules
    `;
    const result = await exec.query(query);
    return result.map((row: any) => this.mapToDomain(row));
  }

  private mapToDomain(row: any): MenuToppingRule {
    return new MenuToppingRule(
      row.id,
      row.menu_type as MenuTypeValue,
      row.max_toppings !== null ? Number(row.max_toppings) : null,
      row.allow_free_selection === 1,
      row.description ?? null
    );
  }
}

import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";
import {
  CatalogQueryPorts,
  ProductSnapshot,
  ToppingSnapshot,
  BeverageSnapshot,
  ComboSnapshot,
  AllowedToppingForProduct,
} from "../../application/use-cases/CreateOrderUseCase.ts";

/**
 * Adaptador de infraestructura que implementa CatalogQueryPorts.
 * Conecta el módulo Orders con las tablas de catálogo sin acoplar
 * directamente a las entidades del módulo Catalog.
 * 
 * Este patrón Anti-Corruption Layer permite que Orders evolucione
 * de forma independiente al módulo Catalog.
 */
export class MySQLCatalogQueryAdapter implements CatalogQueryPorts {
  async findProductById(id: number, dbExecutor?: QueryExecutor): Promise<ProductSnapshot | null> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      `SELECT id, name, price_universitario, price_especial, has_toppings, available_in, is_active
       FROM products WHERE id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      priceUniversitario: row.price_universitario !== null ? Number(row.price_universitario) : null,
      priceEspecial: row.price_especial !== null ? Number(row.price_especial) : null,
      hasToppings: row.has_toppings === 1,
      availableIn: row.available_in,
      isActive: row.is_active === 1,
    };
  }

  async findToppingById(id: number, dbExecutor?: QueryExecutor): Promise<ToppingSnapshot | null> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      `SELECT id, name, extra_price, is_active FROM toppings WHERE id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      extraPrice: Number(row.extra_price),
      isActive: row.is_active === 1,
    };
  }

  async findBeverageById(id: number, dbExecutor?: QueryExecutor): Promise<BeverageSnapshot | null> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      `SELECT id, name, price, is_active FROM beverages WHERE id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      price: Number(row.price),
      isActive: row.is_active === 1,
    };
  }

  async findComboById(id: number, dbExecutor?: QueryExecutor): Promise<ComboSnapshot | null> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      `SELECT id, name, price, is_active, valid_from, valid_until
       FROM combos WHERE id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      price: Number(row.price),
      isActive: row.is_active === 1,
      validFrom: row.valid_from ? new Date(row.valid_from) : null,
      validUntil: row.valid_until ? new Date(row.valid_until) : null,
    };
  }

  async findAllowedToppingsForProduct(productId: number, dbExecutor?: QueryExecutor): Promise<AllowedToppingForProduct[]> {
    const exec = dbExecutor || client;
    const rows = await exec.query(
      `SELECT product_id, topping_id FROM product_allowed_toppings WHERE product_id = ?`,
      [productId]
    );
    return rows.map((row: any) => ({
      productId: row.product_id,
      toppingId: row.topping_id,
    }));
  }
}

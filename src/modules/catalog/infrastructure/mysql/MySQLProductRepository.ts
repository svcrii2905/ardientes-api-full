import { Product } from "../../domain/Product.ts";
import { ProductRepository } from "../../domain/ProductRepository.ts";
import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

export class MySQLProductRepository implements ProductRepository {
  async save(product: Product, dbExecutor?: QueryExecutor): Promise<Product> {
    const exec = dbExecutor || client;
    const query = `
      INSERT INTO products (
        category_id, sku, name, description, 
        price_universitario, price_especial, 
        image_url, has_toppings, available_in, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await exec.execute(query, [
      product.categoryId,
      product.sku,
      product.name,
      product.description,
      product.priceUniversitario,
      product.priceEspecial,
      product.imageUrl,
      product.hasToppings ? 1 : 0,
      product.availableIn,
      product.isActive ? 1 : 0
    ]);
    return new Product(
      result.lastInsertId ?? null,
      product.categoryId,
      product.sku,
      product.name,
      product.description,
      product.priceUniversitario,
      product.priceEspecial,
      product.imageUrl,
      product.hasToppings,
      product.availableIn,
      product.isActive
    );
  }

  async findById(id: number, dbExecutor?: QueryExecutor): Promise<Product | null> {
    const exec = dbExecutor || client;
    const query = `SELECT * FROM products WHERE id = ?`;
    const result = await exec.query(query, [id]);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findBySku(sku: string, dbExecutor?: QueryExecutor): Promise<Product | null> {
    const exec = dbExecutor || client;
    const query = `SELECT * FROM products WHERE sku = ?`;
    const result = await exec.query(query, [sku]);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByCategory(categoryId: number, onlyActive: boolean = false, dbExecutor?: QueryExecutor): Promise<Product[]> {
    const exec = dbExecutor || client;
    let query = `SELECT * FROM products WHERE category_id = ?`;
    const params: any[] = [categoryId];
    if (onlyActive) {
      query += ` AND is_active = 1`;
    }
    const result = await exec.query(query, params);
    return result.map((row: any) => this.mapToDomain(row));
  }

  async findAll(onlyActive: boolean = false, dbExecutor?: QueryExecutor): Promise<Product[]> {
    const exec = dbExecutor || client;
    let query = `SELECT * FROM products`;
    if (onlyActive) {
      query += ` WHERE is_active = 1`;
    }
    const result = await exec.query(query);
    return result.map((row: any) => this.mapToDomain(row));
  }

  async update(product: Product, dbExecutor?: QueryExecutor): Promise<void> {
    const exec = dbExecutor || client;
    const query = `
      UPDATE products 
      SET category_id = ?, sku = ?, name = ?, description = ?, 
          price_universitario = ?, price_especial = ?, 
          image_url = ?, has_toppings = ?, available_in = ?, is_active = ?
      WHERE id = ?
    `;
    await exec.execute(query, [
      product.categoryId,
      product.sku,
      product.name,
      product.description,
      product.priceUniversitario,
      product.priceEspecial,
      product.imageUrl,
      product.hasToppings ? 1 : 0,
      product.availableIn,
      product.isActive ? 1 : 0,
      product.id
    ]);
  }

  async delete(id: number, dbExecutor?: QueryExecutor): Promise<void> {
    const exec = dbExecutor || client;
    const query = `DELETE FROM products WHERE id = ?`;
    await exec.execute(query, [id]);
  }

  private mapToDomain(row: any): Product {
    return new Product(
      row.id,
      row.category_id,
      row.sku,
      row.name,
      row.description,
      row.price_universitario !== null ? Number(row.price_universitario) : null,
      row.price_especial !== null ? Number(row.price_especial) : null,
      row.image_url,
      row.has_toppings === 1,
      row.available_in,
      row.is_active === 1
    );
  }
}

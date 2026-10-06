import { Category } from "../../domain/Category.ts";
import { CategoryRepository } from "../../domain/CategoryRepository.ts";
import { client, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

export class MySQLCategoryRepository implements CategoryRepository {
  async save(category: Category, dbExecutor?: QueryExecutor): Promise<Category> {
    const exec = dbExecutor || client;
    const query = `
      INSERT INTO categories (name, icon_url, sort_order, is_active) 
      VALUES (?, ?, ?, ?)
    `;
    const result = await exec.execute(query, [
      category.name,
      category.iconUrl,
      category.sortOrder,
      category.isActive ? 1 : 0
    ]);
    return new Category(
      result.lastInsertId ?? null,
      category.name,
      category.iconUrl,
      category.sortOrder,
      category.isActive
    );
  }

  async findById(id: number, dbExecutor?: QueryExecutor): Promise<Category | null> {
    const exec = dbExecutor || client;
    const query = `SELECT * FROM categories WHERE id = ?`;
    const result = await exec.query(query, [id]);
    if (result.length === 0) return null;
    const row = result[0];
    return new Category(row.id, row.name, row.icon_url, row.sort_order, row.is_active === 1);
  }

  async findByName(name: string, dbExecutor?: QueryExecutor): Promise<Category | null> {
    const exec = dbExecutor || client;
    const query = `SELECT * FROM categories WHERE name = ?`;
    const result = await exec.query(query, [name]);
    if (result.length === 0) return null;
    const row = result[0];
    return new Category(row.id, row.name, row.icon_url, row.sort_order, row.is_active === 1);
  }

  async findAll(onlyActive: boolean = false, dbExecutor?: QueryExecutor): Promise<Category[]> {
    const exec = dbExecutor || client;
    let query = `SELECT * FROM categories`;
    if (onlyActive) {
      query += ` WHERE is_active = 1`;
    }
    query += ` ORDER BY sort_order ASC`;
    const result = await exec.query(query);
    return result.map((row: any) => 
      new Category(row.id, row.name, row.icon_url, row.sort_order, row.is_active === 1)
    );
  }

  async update(category: Category, dbExecutor?: QueryExecutor): Promise<void> {
    const exec = dbExecutor || client;
    const query = `
      UPDATE categories 
      SET name = ?, icon_url = ?, sort_order = ?, is_active = ?
      WHERE id = ?
    `;
    await exec.execute(query, [
      category.name,
      category.iconUrl,
      category.sortOrder,
      category.isActive ? 1 : 0,
      category.id
    ]);
  }

  async delete(id: number, dbExecutor?: QueryExecutor): Promise<void> {
    const exec = dbExecutor || client;
    const query = `DELETE FROM categories WHERE id = ?`;
    await exec.execute(query, [id]);
  }
}

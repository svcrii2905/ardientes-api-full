import { Category } from "./Category.ts";

export interface CategoryRepository {
  save(category: Category): Promise<Category>;
  findById(id: number): Promise<Category | null>;
  findByName(name: string): Promise<Category | null>;
  findAll(onlyActive?: boolean): Promise<Category[]>;
  update(category: Category): Promise<void>;
  delete(id: number): Promise<void>;
}

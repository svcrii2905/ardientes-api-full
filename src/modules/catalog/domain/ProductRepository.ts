import { Product } from "./Product.ts";

export interface ProductRepository {
  save(product: Product): Promise<Product>;
  findById(id: number): Promise<Product | null>;
  findBySku(sku: string): Promise<Product | null>;
  findByCategory(categoryId: number, onlyActive?: boolean): Promise<Product[]>;
  findAll(onlyActive?: boolean): Promise<Product[]>;
  update(product: Product): Promise<void>;
  delete(id: number): Promise<void>;
}

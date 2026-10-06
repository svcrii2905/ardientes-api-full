import { Product } from "../../domain/Product.ts";
import { ProductRepository } from "../../domain/ProductRepository.ts";

export interface GetProductsDTO {
  /** Si se proporciona, filtra por categoría. */
  categoryId?: number;
  /** Si es true, devuelve solo los productos activos. Por defecto: true. */
  onlyActive?: boolean;
}

export class GetProductsUseCase {
  constructor(private productRepository: ProductRepository) {}

  async execute(dto: GetProductsDTO = {}): Promise<Product[]> {
    const onlyActive = dto.onlyActive ?? true;

    if (dto.categoryId !== undefined) {
      return await this.productRepository.findByCategory(dto.categoryId, onlyActive);
    }

    return await this.productRepository.findAll(onlyActive);
  }
}

import { Product, MenuAvailability } from "../../domain/Product.ts";
import { ProductRepository } from "../../domain/ProductRepository.ts";
import { CategoryRepository } from "../../domain/CategoryRepository.ts";
import { ValidationError, NotFoundError } from "../../../../shared/domain/error.ts";

export interface CreateProductDTO {
  categoryId: number;
  sku: string;
  name: string;
  description?: string;
  priceUniversitario?: number;
  priceEspecial?: number;
  imageUrl?: string;
  hasToppings?: boolean;
  availableIn?: MenuAvailability;
}

export class CreateProductUseCase {
  constructor(
    private productRepository: ProductRepository,
    private categoryRepository: CategoryRepository
  ) {}

  async execute(dto: CreateProductDTO): Promise<Product> {
    const category = await this.categoryRepository.findById(dto.categoryId);
    if (!category) {
      throw new NotFoundError(`Category with ID ${dto.categoryId} not found`);
    }

    const existingSku = await this.productRepository.findBySku(dto.sku);
    if (existingSku) {
      throw new ValidationError(`Product with SKU '${dto.sku}' already exists`);
    }

    const product = new Product(
      null,
      dto.categoryId,
      dto.sku,
      dto.name,
      dto.description || null,
      dto.priceUniversitario || null,
      dto.priceEspecial || null,
      dto.imageUrl || null,
      dto.hasToppings || false,
      dto.availableIn || 'AMBOS',
      true // active by default
    );

    return await this.productRepository.save(product);
  }
}

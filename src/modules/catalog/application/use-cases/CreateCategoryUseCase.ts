import { Category } from "../../domain/Category.ts";
import { CategoryRepository } from "../../domain/CategoryRepository.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";

export interface CreateCategoryDTO {
  name: string;
  iconUrl?: string;
  sortOrder?: number;
}

export class CreateCategoryUseCase {
  constructor(private categoryRepository: CategoryRepository) {}

  async execute(dto: CreateCategoryDTO): Promise<Category> {
    if (!dto.name) {
      throw new ValidationError("Category name is required");
    }

    const existing = await this.categoryRepository.findByName(dto.name);
    if (existing) {
      throw new ValidationError(`Category with name '${dto.name}' already exists`);
    }

    const category = new Category(
      null,
      dto.name,
      dto.iconUrl || null,
      dto.sortOrder || 0,
      true // active by default
    );

    return await this.categoryRepository.save(category);
  }
}

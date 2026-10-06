import { Category } from "../../domain/Category.ts";
import { CategoryRepository } from "../../domain/CategoryRepository.ts";

export class GetCategoriesUseCase {
  constructor(private categoryRepository: CategoryRepository) {}

  async execute(onlyActive: boolean = false): Promise<Category[]> {
    return await this.categoryRepository.findAll(onlyActive);
  }
}

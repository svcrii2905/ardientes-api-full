import { MySQLCategoryRepository } from "./mysql/MySQLCategoryRepository.ts";
import { MySQLProductRepository } from "./mysql/MySQLProductRepository.ts";
import { CreateCategoryUseCase } from "../application/use-cases/CreateCategoryUseCase.ts";
import { GetCategoriesUseCase } from "../application/use-cases/GetCategoriesUseCase.ts";
import { CreateProductUseCase } from "../application/use-cases/CreateProductUseCase.ts";
import { GetProductsUseCase } from "../application/use-cases/GetProductsUseCase.ts";
import { CategoryController } from "./http/CategoryController.ts";
import { ProductController } from "./http/ProductController.ts";

// Repositories
export const categoryRepository = new MySQLCategoryRepository();
export const productRepository = new MySQLProductRepository();

// Use Cases
export const createCategoryUseCase = new CreateCategoryUseCase(categoryRepository);
export const getCategoriesUseCase = new GetCategoriesUseCase(categoryRepository);
export const createProductUseCase = new CreateProductUseCase(productRepository, categoryRepository);
export const getProductsUseCase = new GetProductsUseCase(productRepository);

// Controllers
export const categoryController = new CategoryController(createCategoryUseCase, getCategoriesUseCase);
export const productController = new ProductController(createProductUseCase, getProductsUseCase);

export const catalogDependencies = {
  categoryController,
  productController,
};

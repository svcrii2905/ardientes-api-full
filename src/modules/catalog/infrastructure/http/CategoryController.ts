import { Context } from "oak";
import { CreateCategoryUseCase, CreateCategoryDTO } from "../../application/use-cases/CreateCategoryUseCase.ts";
import { GetCategoriesUseCase } from "../../application/use-cases/GetCategoriesUseCase.ts";
import { isStringWithin } from "../../../../common/validation.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";

export class CategoryController {
  constructor(
    private createCategoryUseCase: CreateCategoryUseCase,
    private getCategoriesUseCase: GetCategoriesUseCase
  ) {}

  async create(ctx: Context) {
    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    const payload = await body.value;
    
    if (!isStringWithin(payload.name, 80)) {
      throw new ValidationError("El nombre de la categoría debe ser una cadena de máximo 80 caracteres");
    }
    if (payload.iconUrl !== undefined && payload.iconUrl !== null && !isStringWithin(payload.iconUrl, 255)) {
      throw new ValidationError("La URL del ícono debe ser una cadena de máximo 255 caracteres");
    }

    const dto: CreateCategoryDTO = {
      name: payload.name,
      iconUrl: payload.iconUrl,
      sortOrder: payload.sortOrder,
    };

    const category = await this.createCategoryUseCase.execute(dto);

    ctx.response.status = 201;
    ctx.response.body = {
      message: "Categoría creada exitosamente",
      data: category
    };
  }

  async getAll(ctx: Context) {
    // Only fetch active categories by default, unless query param ?all=true is present
    const url = ctx.request.url;
    const onlyActive = url.searchParams.get("all") !== "true";
    
    const categories = await this.getCategoriesUseCase.execute(onlyActive);

    ctx.response.status = 200;
    ctx.response.body = {
      data: categories
    };
  }
}

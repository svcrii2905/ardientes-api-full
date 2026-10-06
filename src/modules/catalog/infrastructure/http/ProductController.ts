import { Context, RouterContext } from "oak";
import { CreateProductUseCase, CreateProductDTO } from "../../application/use-cases/CreateProductUseCase.ts";
import { GetProductsUseCase } from "../../application/use-cases/GetProductsUseCase.ts";
import { client } from "../../../../shared/infrastructure/database.ts";
import { isStringWithin } from "../../../../common/validation.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";

export class ProductController {
  constructor(
    private createProductUseCase: CreateProductUseCase,
    private getProductsUseCase: GetProductsUseCase
  ) {}

  /**
   * GET /api/v1/catalog/products
   * Query params opcionales:
   *   - categoryId (number) → filtra por categoría
   *   - all=true           → incluye productos inactivos
   */
  async getAll(ctx: Context) {
    const url = ctx.request.url;
    const categoryIdParam = url.searchParams.get("categoryId");
    const onlyActive = url.searchParams.get("all") !== "true";

    const products = await this.getProductsUseCase.execute({
      categoryId: categoryIdParam ? Number(categoryIdParam) : undefined,
      onlyActive,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      data: products.map((p) => this.serialize(p)),
    };
  }

  /**
   * POST /api/v1/catalog/products
   */
  async create(ctx: Context) {
    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    const payload = await body.value;

    if (!isStringWithin(payload.sku, 30)) {
      throw new ValidationError("El SKU debe ser una cadena de máximo 30 caracteres");
    }
    if (!isStringWithin(payload.name, 120)) {
      throw new ValidationError("El nombre del producto debe ser una cadena de máximo 120 caracteres");
    }
    if (payload.imageUrl !== undefined && payload.imageUrl !== null && !isStringWithin(payload.imageUrl, 255)) {
      throw new ValidationError("La URL de la imagen debe ser una cadena de máximo 255 caracteres");
    }

    const dto: CreateProductDTO = {
      categoryId: payload.categoryId,
      sku: payload.sku,
      name: payload.name,
      description: payload.description,
      priceUniversitario: payload.priceUniversitario,
      priceEspecial: payload.priceEspecial,
      imageUrl: payload.imageUrl,
      hasToppings: payload.hasToppings,
      availableIn: payload.availableIn,
    };

    const product = await this.createProductUseCase.execute(dto);

    ctx.response.status = 201;
    ctx.response.body = {
      message: "Producto creado exitosamente",
      data: this.serialize(product),
    };
  }

  private serialize(product: any): object {
    return {
      id: product.id,
      categoryId: product.categoryId,
      sku: product.sku,
      name: product.name,
      description: product.description,
      priceUniversitario: product.priceUniversitario,
      priceEspecial: product.priceEspecial,
      imageUrl: product.imageUrl,
      hasToppings: product.hasToppings,
      availableIn: product.availableIn,
      isActive: product.isActive,
    };
  }

  /**
   * GET /api/v1/catalog/products/:id/toppings
   * Obtiene los toppings permitidos para un producto específico.
   */
  async getProductToppings(ctx: RouterContext<"/products/:id/toppings">) {
    const productId = Number(ctx.params.id);
    const rows = await client.query(
      `SELECT t.id, t.name, t.extra_price as extraPrice, t.category, t.is_active as isActive
       FROM toppings t
       JOIN product_allowed_toppings pat ON t.id = pat.topping_id
       WHERE pat.product_id = ? AND t.is_active = 1
       ORDER BY t.name ASC`,
      [productId]
    );

    ctx.response.status = 200;
    ctx.response.body = {
      data: rows.map((r: any) => ({
        id: Number(r.id),
        name: r.name,
        extraPrice: Number(r.extraPrice),
        category: r.category,
        isActive: r.isActive === 1
      }))
    };
  }

  /**
   * GET /api/v1/catalog/beverages
   * Retorna bebidas activas para el selector de promociones en el frontend.
   */
  async getBeverages(ctx: Context) {
    const rows = await client.query(
      `SELECT b.id, b.name, b.price, b.category_id as categoryId
       FROM beverages b
       WHERE b.is_active = 1
       ORDER BY b.name ASC`
    );

    ctx.response.status = 200;
    ctx.response.body = {
      data: rows.map((r: any) => ({
        id: Number(r.id),
        name: r.name,
        price: Number(r.price),
        categoryId: r.categoryId !== null ? Number(r.categoryId) : null,
      }))
    };
  }

  /**
   * GET /api/v1/catalog/menu-rules
   * Obtiene las reglas de toppings configuradas para cada tipo de menú.
   */
  async getMenuRules(ctx: Context) {
    const rows = await client.query(
      "SELECT id, menu_type as menuType, max_toppings as maxToppings, allow_free_selection as allowFreeSelection, description FROM menu_topping_rules"
    );

    ctx.response.status = 200;
    ctx.response.body = {
      data: rows.map((r: any) => ({
        id: Number(r.id),
        menuType: r.menuType,
        maxToppings: r.maxToppings !== null ? Number(r.maxToppings) : null,
        allowFreeSelection: r.allowFreeSelection === 1,
        description: r.description
      }))
    };
  }
}


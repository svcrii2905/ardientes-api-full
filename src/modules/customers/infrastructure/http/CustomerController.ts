import { Context, RouterContext } from "oak";
import { SearchCustomerUseCase } from "../../application/use-cases/SearchCustomerUseCase.ts";
import { CreateCustomerUseCase, CreateCustomerDTO } from "../../application/use-cases/CreateCustomerUseCase.ts";
import { RedeemPointsUseCase, RedeemPointsDTO } from "../../application/use-cases/RedeemPointsUseCase.ts";
import { GetCustomerLoyaltyUseCase } from "../../application/use-cases/GetCustomerLoyaltyUseCase.ts";
import { GenerateActivationCodeUseCase } from "../../application/use-cases/GenerateActivationCodeUseCase.ts";
import { CustomerRepository } from "../../domain/CustomerRepository.ts";
import { NotFoundError, ValidationError } from "../../../../shared/domain/error.ts";
import { isStringWithin, isISODateString } from "../../../../common/validation.ts";

export class CustomerController {
  constructor(
    private readonly searchCustomerUseCase: SearchCustomerUseCase,
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly redeemPointsUseCase: RedeemPointsUseCase,
    private readonly getCustomerLoyaltyUseCase: GetCustomerLoyaltyUseCase,
    private readonly customerRepository: CustomerRepository,
    private readonly generateActivationCodeUseCase: GenerateActivationCodeUseCase
  ) {}

  /**
   * GET /api/v1/customers
   * Query params: ?q=search_term&limit=20
   */
  async search(ctx: Context) {
    const url = ctx.request.url;
    const query = url.searchParams.get("q") ?? "";

    // Validación: term/q no debe exceder 100 caracteres
    if (!isStringWithin(query, 100)) {
      throw new ValidationError("El término de búsqueda no debe exceder 100 caracteres");
    }

    // Validación: limit entero entre 1 y 100
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam !== null ? Number(limitParam) : 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ValidationError("limit debe ser un entero entre 1 y 100");
    }

    const customers = await this.searchCustomerUseCase.execute(query, limit);

    ctx.response.status = 200;
    ctx.response.body = {
      data: customers.map((c) => this.serializeCustomer(c)),
    };
  }

  /**
   * GET /api/v1/customers/by-phone/:phone
   */
  async findByPhone(ctx: RouterContext<"/by-phone/:phone">) {
    const phone = ctx.params.phone;
    const customer = await this.customerRepository.findByPhone(phone);
    if (!customer) {
      throw new NotFoundError(`Cliente con teléfono '${phone}' no encontrado`);
    }

    ctx.response.status = 200;
    ctx.response.body = {
      data: this.serializeCustomer(customer),
    };
  }

  /**
   * GET /api/v1/customers/:id
   */
  async findById(ctx: RouterContext<"/:id">) {
    const id = Number(ctx.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError("El ID del cliente debe ser un entero positivo");
    }
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new NotFoundError(`Cliente con ID ${id} no encontrado`);
    }

    ctx.response.status = 200;
    ctx.response.body = {
      data: this.serializeCustomer(customer),
    };
  }

  /**
   * POST /api/v1/customers
   */
  async create(ctx: Context) {
    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    const payload = await body.value;

    if (!isStringWithin(payload.fullName, 120)) {
      throw new ValidationError("El nombre completo debe ser una cadena de máximo 120 caracteres");
    }
    if (!isStringWithin(payload.phone, 20)) {
      throw new ValidationError("El teléfono debe ser una cadena de máximo 20 caracteres");
    }
    if (payload.email !== undefined && payload.email !== null && !isStringWithin(payload.email, 120)) {
      throw new ValidationError("El email debe ser una cadena de máximo 120 caracteres");
    }
    if (payload.address !== undefined && payload.address !== null && !isStringWithin(payload.address, 500)) {
      throw new ValidationError("La dirección debe ser una cadena de máximo 500 caracteres");
    }
    if (payload.birthDate !== undefined && payload.birthDate !== null && !isISODateString(payload.birthDate)) {
      throw new ValidationError("La fecha de nacimiento debe ser una fecha ISO válida");
    }

    const dto: CreateCustomerDTO = {
      fullName: payload.fullName,
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      birthDate: payload.birthDate,
    };

    const customer = await this.createCustomerUseCase.execute(dto);

    ctx.response.status = 201;
    ctx.response.body = {
      message: "Cliente registrado exitosamente",
      data: this.serializeCustomer(customer),
    };
  }

  /**
   * GET /api/v1/customers/:id/loyalty
   */
  async getLoyalty(ctx: RouterContext<"/:id/loyalty">) {
    const id = Number(ctx.params.id);
    const loyalty = await this.getCustomerLoyaltyUseCase.execute(id);

    ctx.response.status = 200;
    ctx.response.body = {
      data: loyalty,
    };
  }

  /**
   * POST /api/v1/customers/:id/redeem
   * Body: { rewardCount, performedBy, orderId?, notes? }
   */
  async redeem(ctx: RouterContext<"/:id/redeem">) {
    const id = Number(ctx.params.id);
    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    const payload = await body.value;

    if (payload.notes !== undefined && payload.notes !== null && !isStringWithin(payload.notes, 255)) {
      throw new ValidationError("Las notas deben ser una cadena de máximo 255 caracteres");
    }

    const authUser = (ctx.state as any).user;

    const dto: RedeemPointsDTO = {
      customerId: id,
      rewardCount: payload.rewardCount ?? 1,
      performedBy: authUser.id,
      orderId: payload.orderId ?? null,
      notes: payload.notes ?? null,
    };

    const result = await this.redeemPointsUseCase.execute(dto);

    ctx.response.status = 200;
    ctx.response.body = {
      message: `¡Se han canjeado ${result.redeemedRewards} hamburguesa(s) gratis con éxito!`,
      data: result,
    };
  }

  /**
   * POST /api/v1/customers/:id/activation-code
   * Genera un código de activación de un solo uso para que un cliente de Caja active su cuenta web.
   */
  async generateActivationCode(ctx: RouterContext<"/:id/activation-code">): Promise<void> {
    const customerId = Number(ctx.params.id);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      throw new ValidationError("ID de cliente inválido");
    }

    const authUser = (ctx.state as any).user;
    if (!authUser || !authUser.id) {
      throw new ValidationError("Usuario autenticado inválido");
    }

    const result = await this.generateActivationCodeUseCase.execute({
      customerId,
      createdBy: authUser.id,
    });

    ctx.response.status = 201;
    ctx.response.body = result;
  }

  private serializeCustomer(customer: any): object {
    return {
      id: customer.id,
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      loyaltyPoints: customer.loyaltyPoints,
      availableRewards: customer.getAvailableRewards ? customer.getAvailableRewards() : Math.floor((customer.loyaltyPoints || 0) / 10),
      pointsToNextReward: customer.getPointsToNextReward ? customer.getPointsToNextReward() : (10 - ((customer.loyaltyPoints || 0) % 10)),
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      birthDate: customer.birthDate ? customer.birthDate.toISOString().slice(0, 10) : null,
      isActive: customer.isActive,
      createdAt: customer.createdAt?.toISOString() ?? null,
    };
  }
}

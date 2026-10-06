import { Context } from "oak";
import { RegisterCustomerUseCase } from "../../application/use-cases/RegisterCustomerUseCase.ts";
import { CustomerLoginUseCase } from "../../application/use-cases/CustomerLoginUseCase.ts";
import { ActivateCustomerUseCase } from "../../application/use-cases/ActivateCustomerUseCase.ts";
import { ValidationError, UnauthorizedError } from "../../../../shared/domain/error.ts";
import { Customer } from "../../domain/Customer.ts";

export class CustomerAuthController {
  constructor(
    private readonly registerCustomerUseCase: RegisterCustomerUseCase,
    private readonly customerLoginUseCase: CustomerLoginUseCase,
    private readonly activateCustomerUseCase: ActivateCustomerUseCase
  ) {}

  /**
   * POST /api/v1/client/register
   * Registro de un nuevo cliente o vinculación de cuenta a cliente preexistente
   */
  async register(ctx: Context): Promise<void> {
    if (!ctx.request.hasBody) {
      throw new ValidationError("El cuerpo de la petición no puede estar vacío");
    }

    const body = ctx.request.body({ type: "json", limit: 65_536 });
    const payload = await body.value;

    const result = await this.registerCustomerUseCase.execute({
      fullName: payload.fullName,
      phone: payload.phone,
      email: payload.email,
      password: payload.password,
      address: payload.address,
    });

    ctx.response.status = 201;
    ctx.response.body = {
      success: true,
      message: result.message,
      data: {
        accessToken: result.accessToken,
        customer: result.customer,
        isExistingLinked: result.isExistingLinked,
      },
    };
  }

  /**
   * POST /api/v1/client/login
   * Autenticación exclusiva de clientes contra la tabla `customers`
   */
  async login(ctx: Context): Promise<void> {
    if (!ctx.request.hasBody) {
      throw new ValidationError("El cuerpo de la petición no puede estar vacío");
    }

    const body = ctx.request.body({ type: "json", limit: 65_536 });
    const payload = await body.value;

    const identifier = payload.identifier || payload.phone || payload.email;
    const password = payload.password;

    const result = await this.customerLoginUseCase.execute({
      identifier,
      password,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Autenticación de cliente exitosa",
      data: {
        accessToken: result.accessToken,
        customer: result.customer,
      },
    };
  }

  /**
   * POST /api/v1/client/activate
   * Activación de cliente existente mediante código emitido en Caja
   */
  async activate(ctx: Context): Promise<void> {
    if (!ctx.request.hasBody) {
      throw new ValidationError("El cuerpo de la petición no puede estar vacío");
    }

    const body = ctx.request.body({ type: "json", limit: 65_536 });
    const payload = await body.value;

    const result = await this.activateCustomerUseCase.execute({
      phone: payload.phone,
      activationCode: payload.activationCode,
      password: payload.password,
      email: payload.email,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: result.message,
      data: {
        accessToken: result.accessToken,
        customer: result.customer,
      },
    };
  }

  /**
   * GET /api/v1/client/me
   * Retorna el perfil seguro del cliente autenticado a partir de su JWT verificado
   */
  getMe(ctx: Context): void {
    const customer = (ctx.state as any).customer as Customer | undefined;
    if (!customer || !customer.id) {
      throw new UnauthorizedError("Autenticación de cliente requerida");
    }

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: {
        customer: customer.toSafeClientObject(),
      },
    };
  }
}

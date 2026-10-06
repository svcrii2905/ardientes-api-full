import { Context } from "oak";
import { ListDriversUseCase } from "../../application/use-cases/ListDriversUseCase.ts";

export class UserController {
  constructor(
    private readonly listDriversUseCase: ListDriversUseCase
  ) {}

  /**
   * GET /api/v1/users/drivers
   * Obtiene la lista de usuarios activos con el rol DOMICILIARIO.
   * La validación de autorización (requirePermission) se debe realizar en el router.
   */
  async getDrivers(ctx: Context): Promise<void> {
    const drivers = await this.listDriversUseCase.execute();
    ctx.response.status = 200;
    ctx.response.body = drivers;
  }
}

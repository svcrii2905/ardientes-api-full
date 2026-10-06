import { Context } from "oak";
import { jwtService } from "../../../modules/auth/infrastructure/dependencies.ts";
import { customerRepository } from "../../../modules/customers/infrastructure/dependencies.ts";
import { UnauthorizedError } from "../../domain/error.ts";
import { Customer } from "../../../modules/customers/domain/Customer.ts";

/**
 * Middleware de Autenticación exclusivo para CLIENTES
 * Valida el encabezado Authorization: Bearer <token>, verifica que pertenezca a un CLIENTE,
 * comprueba expiración, tokenVersion e inyecta la entidad Customer en ctx.state.customer.
 * RECHAZA categóricamente tokens de colaboradores (STAFF) o tokens con otro propósito.
 */
export async function customerAuthMiddleware(ctx: Context, next: () => Promise<unknown>): Promise<void> {
  const authHeader = ctx.request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Autenticación de cliente requerida");
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new UnauthorizedError("Token de autenticación de cliente no proporcionado");
  }

  try {
    const payload = await jwtService.verifyCustomerToken(token);

    // 1. RECHAZAR explícitamente si no es de tipo CUSTOMER o propósito incorrecto
    if (payload.userType !== "CUSTOMER" || payload.purpose !== "customer_session") {
      throw new UnauthorizedError("Token no autorizado para el portal de clientes");
    }

    const customerId = payload.customerId;
    if (!customerId || isNaN(customerId)) {
      throw new UnauthorizedError("Identificador de cliente inválido en token");
    }

    // 2. Verificar existencia y estado en la tabla `customers`
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new UnauthorizedError("Cliente no encontrado");
    }

    if (!customer.isActive) {
      throw new UnauthorizedError("Cuenta de cliente inactiva o deshabilitada");
    }

    // 3. Validar tokenVersion contra la base de datos (revocación de sesiones)
    if (typeof payload.tokenVersion === "number" && customer.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedError("Sesión de cliente revocada o invalidada. Por favor inicia sesión nuevamente.");
    }

    // 4. Inyectar cliente autenticado en ctx.state (NUNCA en ctx.state.user de colaboradores)
    (ctx.state as { customer: Customer }).customer = customer;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    throw new UnauthorizedError("Token de autenticación de cliente inválido o expirado");
  }

  await next();
}

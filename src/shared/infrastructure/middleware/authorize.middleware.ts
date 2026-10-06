import { Context } from "oak";
import { ForbiddenError, UnauthorizedError } from "../../domain/error.ts";
import { AuthenticatedUser } from "../../types/auth.ts";

/**
 * Middleware Factory: requirePermission(...permissions)
 * Verifica que el usuario autenticado posea al menos uno de los permisos indicados (o sea ADMIN).
 * Si no cumple, responde con HTTP 403 Forbidden.
 */
export function requirePermission(...requiredPermissions: string[]) {
  return async (ctx: Context, next: () => Promise<unknown>): Promise<void> => {
    const user = (ctx.state as { user?: AuthenticatedUser }).user;

    if (!user) {
      throw new UnauthorizedError("Autenticación requerida");
    }

    // Rol ADMIN posee acceso total por definición
    if (user.roles.some((r) => r.toUpperCase() === "ADMIN")) {
      await next();
      return;
    }

    // Verificar si el usuario tiene al menos uno de los permisos requeridos
    const hasPermission = user.permissions.some((p) =>
      requiredPermissions.includes(p)
    );

    if (!hasPermission) {
      throw new ForbiddenError(
        "Acceso denegado: No cuenta con los permisos necesarios para realizar esta acción"
      );
    }

    await next();
  };
}

/**
 * Middleware Factory: requireRole(...roles)
 * Verifica que el usuario autenticado posea al menos uno de los roles indicados.
 * Si no cumple, responde con HTTP 403 Forbidden.
 */
export function requireRole(...requiredRoles: string[]) {
  const normalizedRequiredRoles = requiredRoles.map((r) => r.toUpperCase());

  return async (ctx: Context, next: () => Promise<unknown>): Promise<void> => {
    const user = (ctx.state as { user?: AuthenticatedUser }).user;

    if (!user) {
      throw new UnauthorizedError("Autenticación requerida");
    }

    // Rol ADMIN posee acceso total
    if (user.roles.some((r) => r.toUpperCase() === "ADMIN")) {
      await next();
      return;
    }

    const hasRole = user.roles.some((r) =>
      normalizedRequiredRoles.includes(r.toUpperCase())
    );

    if (!hasRole) {
      throw new ForbiddenError(
        "Acceso denegado: No posee el rol requerido para realizar esta acción"
      );
    }

    await next();
  };
}

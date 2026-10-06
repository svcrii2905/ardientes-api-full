import { Context } from "oak";
import { jwtService, userRepository } from "../../../modules/auth/infrastructure/dependencies.ts";
import { UnauthorizedError } from "../../domain/error.ts";
import { AuthenticatedUser } from "../../types/auth.ts";

/**
 * Middleware de Autenticación
 * Valida el encabezado Authorization: Bearer <token>, verifica la firma, expiración,
 * propósito de sesión y la versión activa del token (revocación de sesiones).
 * Inyecta la identidad verificada en ctx.state.user.
 */
export async function authMiddleware(ctx: Context, next: () => Promise<unknown>): Promise<void> {
  const authHeader = ctx.request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Autenticación requerida");
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new UnauthorizedError("Token de autenticación no proporcionado");
  }

  try {
    const payload = await jwtService.verifyToken(token);

    // 1. RECHAZAR tokens cuyo propósito no sea sesión (ej. tokens de recuperación 'pwd_reset')
    if (payload.purpose && payload.purpose !== "session") {
      throw new UnauthorizedError("Token no autorizado para acceder a este recurso");
    }

    const userId = Number(payload.sub);
    if (isNaN(userId)) {
      throw new UnauthorizedError("Identificador de usuario inválido en token");
    }

    // 2. Si el token incluye tokenVersion, verificar contra la versión actual en BD
    if (typeof payload.tokenVersion === "number") {
      const dbUser = await userRepository.findById(userId);
      if (!dbUser || !dbUser.isActive || dbUser.tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedError("Sesión revocada o invalidada. Por favor inicie sesión nuevamente.");
      }
    }

    const user: AuthenticatedUser = {
      id: userId,
      username: payload.username,
      fullName: payload.fullName,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
    };

    (ctx.state as { user: AuthenticatedUser }).user = user;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    // No revelar detalles internos del JWT
    throw new UnauthorizedError("Token de autenticación inválido o expirado");
  }

  await next();
}

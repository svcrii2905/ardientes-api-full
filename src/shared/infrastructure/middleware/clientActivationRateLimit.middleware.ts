import { Context, Middleware } from "oak";

/**
 * Rate limiting middleware para el endpoint de activación de clientes (/api/v1/client/activate).
 * Limita cada IP a 10 intentos de activación por ventana de 15 minutos.
 * Devuelve HTTP 429 con cabecera Retry-After cuando se supera el límite.
 */
export const clientActivationRateLimitMiddleware: Middleware = async (ctx: Context, next) => {
  const ip = ctx.request.ip ?? "unknown";
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutos
  const maxRequests = 10; // Máximo 10 intentos por IP

  if (!(globalThis as any).__clientActivationRateLimitStore) {
    (globalThis as any).__clientActivationRateLimitStore = new Map<string, { count: number; resetTime: number }>();
  }
  const store: Map<string, { count: number; resetTime: number }> = (globalThis as any).__clientActivationRateLimitStore;

  const entry = store.get(ip);
  if (!entry || entry.resetTime <= now) {
    store.set(ip, { count: 1, resetTime: now + windowMs });
    await next();
    return;
  }

  if (entry.count >= maxRequests) {
    const retryAfterSec = Math.ceil((entry.resetTime - now) / 1000);
    ctx.response.status = 429;
    ctx.response.headers.set("Retry-After", retryAfterSec.toString());
    ctx.response.body = {
      error: "Demasiados intentos de activación. Por favor intenta más tarde.",
      retryAfter: retryAfterSec,
    };
    return;
  }

  entry.count += 1;
  await next();
};

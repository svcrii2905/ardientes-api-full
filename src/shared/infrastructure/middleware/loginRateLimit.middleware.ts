import { Context, Middleware } from "oak";
import { config } from "../../../config/env.ts";

/**
 * Rate limiting middleware for the login endpoint.
 * Limits each IP to 10 login attempts per 15‑minute window.
 * Returns HTTP 429 with a Retry‑After header when the limit is exceeded.
 * Does NOT trust X‑Forwarded‑For; uses the remote IP provided by Oak.
 */
export const loginRateLimitMiddleware: Middleware = async (ctx: Context, next) => {
  const ip = ctx.request.ip ?? "unknown";
  const now = Date.now();
  const windowMs = config.rateLimit?.windowMs ?? 15 * 60 * 1000; // fallback to 15 min
  const maxRequests = config.rateLimit?.maxRequests ?? 10; // fallback to 10 attempts

  // Global in‑memory store for login attempts per IP
  if (!(globalThis as any).__loginRateLimitStore) {
    (globalThis as any).__loginRateLimitStore = new Map<string, { count: number; resetTime: number }>();
  }
  const store: Map<string, { count: number; resetTime: number }> = (globalThis as any).__loginRateLimitStore;

  const entry = store.get(ip);
  if (!entry || entry.resetTime <= now) {
    // New window
    store.set(ip, { count: 1, resetTime: now + windowMs });
    await next();
    return;
  }

  if (entry.count >= maxRequests) {
    const retryAfterSec = Math.ceil((entry.resetTime - now) / 1000);
    ctx.response.status = 429;
    ctx.response.headers.set("Retry-After", retryAfterSec.toString());
    ctx.response.body = { error: "Too many login attempts", retryAfter: retryAfterSec };
    return;
  }

  entry.count += 1;
  await next();
};

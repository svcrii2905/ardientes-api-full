// src/shared/infrastructure/middleware/securityHeaders.middleware.ts
// Security HTTP response headers middleware for Ardientes POS.

import { Context, Middleware } from "oak";

export const securityHeadersMiddleware: Middleware = async (ctx: Context, next) => {
  // Prevent MIME type sniffing
  ctx.response.headers.set("X-Content-Type-Options", "nosniff");
  // Disallow framing (POS UI is not meant to be embedded)
  ctx.response.headers.set("X-Frame-Options", "DENY");
  // Referrer policy for better privacy
  ctx.response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Restrictive Permissions-Policy – disable most powerful features that are not needed.
  ctx.response.headers.set(
    "Permissions-Policy",
    "accelerometer=(),camera=(),geolocation=(),gyroscope=(),magnetometer=(),microphone=(),payment=(),usb=()",
  );
  // Note: Content-Security-Policy is intentionally omitted until a safe policy can be defined.
  await next();
};

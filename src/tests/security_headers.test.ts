// Security Headers Tests using native Oak Application.handle
import { Application, Router, send } from "oak";
import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { securityHeadersMiddleware } from "../shared/infrastructure/middleware/securityHeaders.middleware.ts";
import { config } from "../config/env.ts";

// Minimal CORS middleware (same logic as main.ts)
const corsMiddleware = async (ctx: any, next: any) => {
  const requestOrigin = ctx.request.headers.get("origin") || "";
  let allowOrigin = "*"; // dev default
  if (config.allowedOrigins && config.allowedOrigins.trim() !== "") {
    const allowedList = config.allowedOrigins
      .split(",")
      .map((o: string) => o.trim())
      .filter((o: string) => o);
    if (allowedList.includes(requestOrigin)) {
      allowOrigin = requestOrigin;
    } else {
      allowOrigin = "";
    }
  }
  if (allowOrigin) {
    ctx.response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  }
  ctx.response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  );
  ctx.response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  }
  await next();
};

function createTestApp(includeStatic = false) {
  const app = new Application();
  app.use(securityHeadersMiddleware);
  app.use(corsMiddleware);
  const router = new Router();
  router.get("/health", (ctx) => {
    ctx.response.status = 200;
    ctx.response.body = { status: "ok" };
  });
  app.use(router.routes());
  app.use(router.allowedMethods());
  if (includeStatic) {
    app.use(async (ctx) => {
      const root = `${Deno.cwd()}/public`;
      let filePath = ctx.request.url.pathname;
      if (!filePath.includes(".")) filePath = "/index.html";
      try {
        await send(ctx, filePath, { root });
      } catch {
        await send(ctx, "/index.html", { root });
      }
    });
  }
  return app;
}

const expected = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "accelerometer=(),camera=(),geolocation=(),gyroscope=(),magnetometer=(),microphone=(),payment=(),usb=()",
};

function checkHeaders(headers: Headers) {
  for (const [k, v] of Object.entries(expected)) {
    assertEquals(headers.get(k), v, `${k} should be ${v}`);
  }
}

async function makeRequest(app: Application, path: string, method = "GET") {
  const request = new Request(`http://localhost${path}`, { method });
  const response = await app.handle(request);
  if (!response) {
    throw new Error('No response returned from app.handle');
  }
  return response;
}

Deno.test("security headers on normal API response (/health)", async () => {
  const app = createTestApp();
  const res = await makeRequest(app, "/health");
  assertEquals(res!.status, 200);
  checkHeaders(res!.headers);
});

Deno.test("security headers on OPTIONS preflight (204)", async () => {
  const app = createTestApp();
  const res = await makeRequest(app, "/any-path", "OPTIONS");
  assertEquals(res.status, 204);
  checkHeaders(res.headers);
});

Deno.test("security headers on static file response", async () => {
  const app = createTestApp(true);
  const res = await makeRequest(app, "/css/base.css");
  // Expect static file (or fallback) to return 200
  assertEquals(res.status, 200);
  checkHeaders(res.headers);
});

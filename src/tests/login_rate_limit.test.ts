// Login Rate Limit Tests using native Oak Application.handle
import { assertEquals, assert } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { Context, Application, Router } from "oak";
import { loginRateLimitMiddleware } from "../shared/infrastructure/middleware/loginRateLimit.middleware.ts";

// Helper to create a minimal mock Context for unit‑style tests.
function createMockContext(ip: string): Context {
  const responseHeaders = new Headers();
  const ctx: any = {
    request: { ip },
    response: {
      status: 200,
      headers: responseHeaders,
      body: undefined,
    },
    // Oak's Context expects some methods; we provide a minimal stub.
    state: {},
    params: {},
  };
  return ctx as Context;
}

function resetStore() {
  (globalThis as any).__loginRateLimitStore = new Map();
}

async function runMiddleware(ctx: Context) {
  await loginRateLimitMiddleware(ctx, async () => {});
}

// ----- Unit style tests (mock Context) -----
Deno.test("allows attempts up to the limit", async () => {
  resetStore();
  for (let i = 1; i <= 10; i++) {
    const ctx = createMockContext("127.0.0.1");
    await runMiddleware(ctx);
    assertEquals(ctx.response.status, 200);
    assert(!ctx.response.headers.has("Retry-After"), "Retry-After should not be set before limit");
  }
});

Deno.test("blocks after exceeding the limit", async () => {
  resetStore();
  for (let i = 0; i < 10; i++) {
    const ctx = createMockContext("127.0.0.1");
    await runMiddleware(ctx);
  }
  const blockedCtx = createMockContext("127.0.0.1");
  await runMiddleware(blockedCtx);
  assertEquals(blockedCtx.response.status, 429);
  const retry = blockedCtx.response.headers.get("Retry-After");
  assert(retry !== null, "Retry-After header present on blocked request");
  const retryNum = Number(retry);
  assert(!Number.isNaN(retryNum) && retryNum > 0, "Retry-After is a positive number");
});

Deno.test("counter resets after window expires", async () => {
  resetStore();
  const ctx1 = createMockContext("127.0.0.1");
  await runMiddleware(ctx1); // first request starts window
  // Fast‑forward the stored entry's resetTime.
  const store: Map<string, { count: number; resetTime: number }> = (globalThis as any).__loginRateLimitStore;
  const entry = store.get("127.0.0.1");
  if (entry) entry.resetTime = Date.now() - 1; // expire
  const ctxAfter = createMockContext("127.0.0.1");
  await runMiddleware(ctxAfter);
  assertEquals(ctxAfter.response.status, 200);
});

Deno.test("different IPs have independent counters", async () => {
  resetStore();
  // Exhaust limit for IP A.
  for (let i = 0; i < 10; i++) {
    const ctxA = createMockContext("10.0.0.1");
    await runMiddleware(ctxA);
  }
  const blockedA = createMockContext("10.0.0.1");
  await runMiddleware(blockedA);
  assertEquals(blockedA.response.status, 429);

  // IP B should still be allowed.
  const ctxB = createMockContext("10.0.0.2");
  await runMiddleware(ctxB);
  assertEquals(ctxB.response.status, 200);
});

// ----- Integration style tests using native Application.handle -----
function createApp(withRateLimit = true) {
  const app = new Application();
  const router = new Router();
  if (withRateLimit) {
    router.post("/login", loginRateLimitMiddleware, (ctx) => {
      ctx.response.status = 200;
      ctx.response.body = { ok: true };
    });
  } else {
    router.post("/login", (ctx) => {
      ctx.response.status = 200;
      ctx.response.body = { ok: true };
    });
  }
  router.get("/status", (ctx) => {
    ctx.response.status = 200;
    ctx.response.body = { status: "ok" };
  });
  app.use(router.routes());
  app.use(router.allowedMethods());
  return app;
}

async function makeRequest(app: Application, path: string, method = "GET", body?: any): Promise<Response> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  const request = new Request(`http://localhost${path}`, init);
  const response = await app.handle(request);
  return response!;
}

Deno.test("allows requests under limit via HTTP", async () => {
  resetStore();
  const app = createApp();
  const res = await makeRequest(app, "/login", "POST", { username: "u", password: "p" });
  assertEquals(res.status, 200);
});

Deno.test("blocks after limit via HTTP", async () => {
  resetStore();
  const app = createApp();
  for (let i = 0; i < 10; i++) {
    const r = await makeRequest(app, "/login", "POST", {});
    assertEquals(r.status, 200);
  }
  const blocked = await makeRequest(app, "/login", "POST", {});
  assertEquals(blocked!.status, 429);
  const retry = blocked!.headers.get("Retry-After");
  assert(retry !== null, "Retry-After header present on blocked request");
});

Deno.test("resets after window via HTTP", async () => {
  resetStore();
  const app = createApp();
  // Exhaust limit.
  for (let i = 0; i < 10; i++) {
    await makeRequest(app, "/login", "POST", {});
  }
  // Expire the window.
  const store = (globalThis as any).__loginRateLimitStore as Map<string, { count: number; resetTime: number }>;
const entry = store.values().next().value;
if (entry) entry.resetTime = Date.now() - 1;

  const after = await makeRequest(app, "/login", "POST", {});
  assertEquals(after!.status, 200);
});

Deno.test("normal endpoint not rate limited", async () => {
  resetStore();
  const app = createApp(false); // login route without rate limit
  for (let i = 0; i < 30; i++) {
    const r = await makeRequest(app, "/status", "GET");
    assertEquals(r!.status, 200);
  }
});

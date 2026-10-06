import { Application, Router, send } from "oak";
import { config } from "./config/env.ts";
import { connectDB, disconnectDB } from "./shared/infrastructure/database.ts";
import { errorMiddleware } from "./shared/infrastructure/middleware/error.middleware.ts";
import { loggerMiddleware } from "./shared/infrastructure/middleware/logger.middleware.ts";
import { catalogRouter } from "./modules/catalog/infrastructure/http/router.ts";
import { ordersRouter } from "./modules/orders/infrastructure/http/router.ts";
import { paymentsRouter } from "./modules/payments/infrastructure/http/router.ts";
import { cashRegisterRouter } from "./modules/cash_register/infrastructure/http/router.ts";
import { inventoryRouter } from "./modules/inventory/infrastructure/http/router.ts";
import { customersRouter } from "./modules/customers/infrastructure/http/router.ts";
import { clientRouter } from "./modules/customers/infrastructure/http/clientRouter.ts";
import { tablesRouter } from "./modules/tables/infrastructure/http/router.ts";
import { authRouter } from "./modules/auth/infrastructure/http/router.ts";
import { usersRouter } from "./modules/auth/infrastructure/http/usersRouter.ts";
import { businessDayRouter } from "./modules/business_day/infrastructure/http/router.ts";
import { securityHeadersMiddleware } from "./shared/infrastructure/middleware/securityHeaders.middleware.ts";

import { webSocketHub } from "./shared/infrastructure/websocket/WebSocketHub.ts";

const app = new Application();
const router = new Router();
app.use(securityHeadersMiddleware);
  // ─── CORS — configurado vía ALLOWED_ORIGINS ─────────────────
  app.use(async (ctx, next) => {
    // Determinar origen solicitado
    const requestOrigin = ctx.request.headers.get("origin") || "";
    let allowOrigin = "*"; // Por defecto para desarrollo
    if (config.allowedOrigins && config.allowedOrigins.trim() !== "") {
      const allowedList = config.allowedOrigins.split(",").map((o) => o.trim()).filter((o) => o);
      if (allowedList.includes(requestOrigin)) {
        allowOrigin = requestOrigin; // origen permitido
      } else {
        // Origen no permitido: no enviar encabezado CORS (el navegador bloqueará)
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
    // Security headers

    await next();
  });

// Middlewares
app.use(loggerMiddleware);
app.use(errorMiddleware);

// Healthcheck route
router.get("/health", (ctx) => {
  ctx.response.status = 200;
  ctx.response.body = {
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Ardientes POS API"
  };
});

// WebSocket real-time endpoint
router.get("/ws", (ctx) => {
  if (!ctx.isUpgradable) {
    ctx.throw(501, "WebSocket connection required");
  }
  const socket = ctx.upgrade();
  webSocketHub.handleConnection(socket);
});

app.use(router.routes());
app.use(router.allowedMethods());

// Mount application routers
app.use(catalogRouter.routes());
app.use(catalogRouter.allowedMethods());

app.use(ordersRouter.routes());
app.use(ordersRouter.allowedMethods());

app.use(paymentsRouter.routes());
app.use(paymentsRouter.allowedMethods());

app.use(cashRegisterRouter.routes());
app.use(cashRegisterRouter.allowedMethods());

app.use(inventoryRouter.routes());
app.use(inventoryRouter.allowedMethods());

app.use(customersRouter.routes());
app.use(customersRouter.allowedMethods());

app.use(clientRouter.routes());
app.use(clientRouter.allowedMethods());

app.use(tablesRouter.routes());
app.use(tablesRouter.allowedMethods());

app.use(authRouter.routes());
app.use(authRouter.allowedMethods());

app.use(usersRouter.routes());
app.use(usersRouter.allowedMethods());

app.use(businessDayRouter.routes());
app.use(businessDayRouter.allowedMethods());

// ─── Static File Server — sirve el frontend SPA desde /public ─────────────
app.use(async (ctx) => {
  const root = `${Deno.cwd()}/public`;
  let filePath = ctx.request.url.pathname;

  // Para rutas SPA que no son archivos, servir index.html
  if (!filePath.includes(".")) {
    filePath = "/index.html";
  }

  try {
    await send(ctx, filePath, { root });
  } catch {
    // Si el archivo no existe, servir index.html (cliente SPA maneja la ruta)
    await send(ctx, "/index.html", { root });
  }
});

// Start server
async function start() {
  try {
    await connectDB();
    console.log(`🔥 Ardientes POS API: http://localhost:${config.port}`);
    console.log(`🌐 Frontend POS:      http://localhost:${config.port}/`);
    await app.listen({ port: config.port });
  } catch (error) {
    console.error("Failed to start server:", error);
    Deno.exit(1);
  }
}

// Graceful shutdown
Deno.addSignalListener("SIGINT", async () => {
  console.log("\nReceived SIGINT, shutting down...");
  await disconnectDB();
  Deno.exit(0);
});

if (import.meta.main) {
  start();
}

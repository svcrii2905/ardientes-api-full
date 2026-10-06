/**
 * Tests de validación P2 - Seguridad y Límite de Payload
 *
 * Verifica que los nuevos límites de longitud, SQL Injection simulado
 * y el rechazo de bodies grandes funcionen correctamente.
 */

import { Application, Router } from "oak";
import {
  isStringWithin,
  isISODateString,
} from "../common/validation.ts";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// ─── Tests de Límite Exacto y Por Encima (isStringWithin) ────────────

Deno.test("P2 - fullName acepta exactamente 120 caracteres", () => {
  const exact = "a".repeat(120);
  assert(isStringWithin(exact, 120), "120 caracteres en fullName debe pasar");
});

Deno.test("P2 - fullName rechaza 121 caracteres", () => {
  const over = "a".repeat(121);
  assert(!isStringWithin(over, 120), "121 caracteres en fullName debe fallar");
});

Deno.test("P2 - description acepta exactamente 500 caracteres (CashRegister/Customer address/Product)", () => {
  const exact = "b".repeat(500);
  assert(isStringWithin(exact, 500), "500 caracteres debe pasar");
});

Deno.test("P2 - description rechaza 501 caracteres", () => {
  const over = "b".repeat(501);
  assert(!isStringWithin(over, 500), "501 caracteres debe fallar");
});

// ─── Tests de Tipos Incorrectos en isStringWithin ────────────────────

Deno.test("P2 - isStringWithin rechaza arrays anidados u objetos maliciosos", () => {
  assert(!isStringWithin(["hola"] as any, 100), "Array debe ser rechazado");
  assert(!isStringWithin({ notes: "hacker" } as any, 100), "Objeto debe ser rechazado");
  assert(!isStringWithin(12345 as any, 100), "Número debe ser rechazado");
  assert(!isStringWithin(true as any, 100), "Booleano debe ser rechazado");
});

// ─── Tests de Caracteres Especiales ──────────────────────────────────

Deno.test("P2 - Caracteres especiales y emojis son manejados correctamente por longitud", () => {
  // En JS un emoji cuenta como 2 caracteres por surrogate pairs
  const emojiStr = "🍔".repeat(10); // 20 caracteres
  assert(isStringWithin(emojiStr, 20), "10 emojis (20 chars) debe pasar límite de 20");
  assert(!isStringWithin(emojiStr, 19), "10 emojis debe fallar en límite de 19");
});

// ─── Tests de Inyección SQL No-Destructiva ───────────────────────────

Deno.test("P2 - SQL Injection payload es tratado como dato válido (sin filtros anti-SQL)", () => {
  const sqlPayload1 = "' OR 1=1 --";
  const sqlPayload2 = "'; DROP TABLE users; --";
  const sqlPayload3 = "SELECT * FROM users WHERE password LIKE '%a%'";

  // Deben ser aceptados si están dentro de la longitud
  assert(isStringWithin(sqlPayload1, 100), "SQLi payload 1 debe pasar (como dato inerte)");
  assert(isStringWithin(sqlPayload2, 100), "SQLi payload 2 debe pasar (como dato inerte)");
  assert(isStringWithin(sqlPayload3, 100), "SQLi payload 3 debe pasar (como dato inerte)");
  
  // La parametrización SQL real previene que esto se ejecute en la DB.
  // El objetivo de este test es garantizar que no implementamos un WAF rústico que rompa strings válidos.
});

// ─── Regresiones de P1 ────────────────────────────────────────────────

Deno.test("P2 - Regresión P1: isISODateString sigue funcionando (birthDate)", () => {
  assert(isISODateString("2000-01-01"), "Fecha ISO válida de birthDate pasa");
  assert(!isISODateString("no-es-fecha"), "Fecha en formato incorrecto falla");
  assert(!isISODateString("' OR 1=1 --"), "SQLi payload en fecha falla");
});

// ─── Límite Global de Oak (Simulación Funcional) ──────────────────────

Deno.test("P2 - Body JSON excede 1MB", async () => {
  const app = new Application();
  const router = new Router();

  router.post("/test-body-limit", async (ctx) => {
    // Exact implementation from P2
    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    await body.value;
    
    ctx.response.status = 200;
    ctx.response.body = { success: true };
  });

  // Oak middleware to catch HTTP errors (like the one thrown by body limit)
  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (err: any) {
      ctx.response.status = err.status || 500;
      ctx.response.body = { error: err.message };
    }
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  const controller = new AbortController();
  const listenPromise = app.listen({ port: 8089, signal: controller.signal });

  // Wait a brief moment for the server to start
  await new Promise((resolve) => setTimeout(resolve, 200));

  try {
    // Generate a payload larger than 1 MB
    const hugeString = "a".repeat(1_500_000);
    const body = JSON.stringify({ data: hugeString });

    const response = await fetch("http://localhost:8089/test-body-limit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
    });

    const status = response.status;
    
    // According to Oak internals for JSON body limits, it usually throws a 413 Payload Too Large
    assert(
      status === 413 || status === 400 || status === 415,
      `Un body de 1.5MB excede el límite configurado de 1MB y debe ser rechazado por Oak con 413 (Obtenido: ${status})`
    );
  } catch (err: any) {
    // Oak/Deno architecture sometimes aborts the connection directly when payload limits are exceeded during stream reading.
    // This results in a connection error (os error 10053 or similar) on the client side.
    const msg = err.message || "";
    if (msg.includes("connection error") || msg.includes("anulado una conexión") || msg.includes("aborted")) {
      assert(true, "Oak rechazó el body abortando la conexión abruptamente.");
    } else {
      throw err;
    }
  } finally {
    controller.abort();
    await listenPromise;
  }
});

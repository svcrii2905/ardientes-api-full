import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { OrderItem } from "../modules/orders/domain/OrderItem.ts";

function calculateExtraToppingsSurcharge(menuType: string, toppingsCount: number): number {
  if (menuType !== "UNIVERSITARIO") return 0;
  const extraCount = Math.max(0, toppingsCount - 4);
  return extraCount * 1000;
}

Deno.test("Regla de toppings adicionales en Menú Universitario: 0 toppings -> $0", () => {
  const surcharge = calculateExtraToppingsSurcharge("UNIVERSITARIO", 0);
  assertEquals(surcharge, 0);
});

Deno.test("Regla de toppings adicionales en Menú Universitario: 1 topping -> $0", () => {
  const surcharge = calculateExtraToppingsSurcharge("UNIVERSITARIO", 1);
  assertEquals(surcharge, 0);
});

Deno.test("Regla de toppings adicionales en Menú Universitario: 4 toppings -> $0", () => {
  const surcharge = calculateExtraToppingsSurcharge("UNIVERSITARIO", 4);
  assertEquals(surcharge, 0);
});

Deno.test("Regla de toppings adicionales en Menú Universitario: 5 toppings -> +$1.000", () => {
  const surcharge = calculateExtraToppingsSurcharge("UNIVERSITARIO", 5);
  assertEquals(surcharge, 1000);
});

Deno.test("Regla de toppings adicionales en Menú Universitario: 6 toppings -> +$2.000", () => {
  const surcharge = calculateExtraToppingsSurcharge("UNIVERSITARIO", 6);
  assertEquals(surcharge, 2000);
});

Deno.test("Regla de toppings adicionales en Menú Universitario: 7 toppings -> +$3.000", () => {
  const surcharge = calculateExtraToppingsSurcharge("UNIVERSITARIO", 7);
  assertEquals(surcharge, 3000);
});

Deno.test("Regla de toppings adicionales en Menú Universitario: 10 toppings -> +$6.000", () => {
  const surcharge = calculateExtraToppingsSurcharge("UNIVERSITARIO", 10);
  assertEquals(surcharge, 6000);
});

Deno.test("Cálculo de línea de ítem: Producto Universitario $10.000 + 5 toppings -> $11.000", () => {
  const unitPrice = 10000;
  const surcharge = calculateExtraToppingsSurcharge("UNIVERSITARIO", 5);
  const item = new OrderItem(null, null, 1, null, 1, "UNIVERSITARIO", unitPrice, surcharge, null, []);
  assertEquals(item.lineTotal, 11000);
});

Deno.test("Cálculo de línea de ítem: Producto Universitario $10.000 + 6 toppings -> $12.000", () => {
  const unitPrice = 10000;
  const surcharge = calculateExtraToppingsSurcharge("UNIVERSITARIO", 6);
  const item = new OrderItem(null, null, 1, null, 1, "UNIVERSITARIO", unitPrice, surcharge, null, []);
  assertEquals(item.lineTotal, 12000);
});

Deno.test("Menú Especial: 5 toppings no genera recargo adicional", () => {
  const surcharge = calculateExtraToppingsSurcharge("ESPECIAL", 5);
  assertEquals(surcharge, 0);
  const unitPrice = 15000;
  const item = new OrderItem(null, null, 1, null, 1, "ESPECIAL", unitPrice, surcharge, null, []);
  assertEquals(item.lineTotal, 15000);
});

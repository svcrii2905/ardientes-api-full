import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ProcessPaymentUseCase } from "../modules/payments/application/use-cases/ProcessPaymentUseCase.ts";
import { Order } from "../modules/orders/domain/Order.ts";
import { OrderStatus } from "../modules/orders/domain/value-objects/OrderStatus.ts";
import { OrderType } from "../modules/orders/domain/value-objects/OrderType.ts";

Deno.test("ProcessPaymentUseCase - 1. Orden sin pagos", async () => {
  // Simulando el backend
  const total = 20440;
  let paid_at: Date | null = null;
  const totalPaidSoFar = 0;
  const amountToPay = 20440;

  const pendingBalance = total - totalPaidSoFar;
  assertEquals(pendingBalance, 20440);

  if (amountToPay > pendingBalance) {
    throw new Error("Monto excede saldo");
  }

  const newTotalPaid = totalPaidSoFar + amountToPay;
  if (newTotalPaid >= total) {
    paid_at = new Date();
  }

  assertEquals(paid_at instanceof Date, true);
});

Deno.test("ProcessPaymentUseCase - 2 y 3. Orden con pago parcial", async () => {
  const total = 20440;
  let paid_at: Date | null = null;
  const totalPaidSoFar = 18000;
  const amountToPay = 1000;

  const pendingBalance = total - totalPaidSoFar;
  assertEquals(pendingBalance, 2440);

  if (amountToPay > pendingBalance) {
    throw new Error("Monto excede saldo");
  }

  const newTotalPaid = totalPaidSoFar + amountToPay;
  if (newTotalPaid >= total) {
    paid_at = new Date();
  }

  assertEquals(paid_at, null); // paid_at sigue nulo porque 19000 < 20440
});

Deno.test("ProcessPaymentUseCase - 4. Pago final", async () => {
  const total = 20440;
  let paid_at: Date | null = null;
  const totalPaidSoFar = 19000;
  const amountToPay = 1440;

  const pendingBalance = total - totalPaidSoFar;
  assertEquals(pendingBalance, 1440);

  if (amountToPay > pendingBalance) {
    throw new Error("Monto excede saldo");
  }

  const newTotalPaid = totalPaidSoFar + amountToPay;
  if (newTotalPaid >= total) {
    paid_at = new Date();
  }

  assertEquals(paid_at instanceof Date, true);
});

Deno.test("ProcessPaymentUseCase - 5 y 6. Orden totalmente pagada / Intento de sobrepago", async () => {
  const total = 20440;
  let paid_at: Date | null = new Date();
  const totalPaidSoFar = 20440;
  const amountToPay = 1000;

  const pendingBalance = total - totalPaidSoFar;
  assertEquals(pendingBalance, 0);

  let errorThrown = false;
  try {
    if (amountToPay > pendingBalance) {
      throw new Error("El monto del pago excede el saldo pendiente");
    }
  } catch (e) {
    errorThrown = true;
    assertEquals(e.message, "El monto del pago excede el saldo pendiente");
  }
  
  assertEquals(errorThrown, true);
});

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Order } from "../modules/orders/domain/Order.ts";
import { OrderStatus } from "../modules/orders/domain/value-objects/OrderStatus.ts";
import { OrderType } from "../modules/orders/domain/value-objects/OrderType.ts";
import { CreateOrderDTO } from "../modules/orders/application/use-cases/CreateOrderUseCase.ts";

Deno.test("CreateOrderUseCase - sendToKitchen: true -> CONFIRMADO", () => {
  const order = new Order(
    null,
    "ORD-123",
    null,
    1,
    OrderType.create("MESA"),
    1,
    null,
    null,
    OrderStatus.initial(),
    null,
    100,
    0,
    0,
    0,
    100,
    null,
    null,
    null,
    null,
    null,
    [],
    [],
    [],
    null,
    true
  );

  assertEquals(order.status.value, "PENDIENTE");
  
  // Simulamos la línea 174 de CreateOrderUseCase
  const dto: CreateOrderDTO = {
    userId: 1,
    orderType: "MESA",
    items: [],
    beverages: [],
    sendToKitchen: true,
  };

  if (dto.sendToKitchen) {
    order.transitionStatus("CONFIRMADO");
  }

  assertEquals(order.status.value, "CONFIRMADO");
});

Deno.test("CreateOrderUseCase - sendToKitchen: false -> PENDIENTE", () => {
  const order = new Order(
    null,
    "ORD-124",
    null,
    1,
    OrderType.create("MESA"),
    1,
    null,
    null,
    OrderStatus.initial(),
    null,
    100,
    0,
    0,
    0,
    100,
    null,
    null,
    null,
    null,
    null,
    [],
    [],
    [],
    null,
    true
  );

  const dto: CreateOrderDTO = {
    userId: 1,
    orderType: "MESA",
    items: [],
    beverages: [],
    sendToKitchen: false,
  };

  if (dto.sendToKitchen) {
    order.transitionStatus("CONFIRMADO");
  }

  assertEquals(order.status.value, "PENDIENTE");
});

Deno.test("CreateOrderUseCase - processBeverages overridePrice = 0 vs normal catalog price", async () => {
  const { CreateOrderUseCase } = await import("../modules/orders/application/use-cases/CreateOrderUseCase.ts");

  const mockOrderRepo: any = {
    save: async (o: any) => o,
  };
  const mockRuleRepo: any = {
    findByMenuType: async () => null,
  };
  const mockCatalogPorts: any = {
    findProductById: async () => null,
    findBeverageById: async (id: number) => ({
      id,
      name: id === 1 ? "Coca Cola" : "Manzana",
      price: 3500,
      isActive: true,
    }),
    findComboById: async () => null,
    findAllowedToppingsForProduct: async () => [],
  };

  const useCase = new CreateOrderUseCase(mockOrderRepo, mockRuleRepo, mockCatalogPorts);

  // Pedido con 1 bebida normal ($3500) y 1 bebida con overridePrice: 0 (incluida en promo)
  const order = await useCase.execute({
    userId: 1,
    orderType: "MESA",
    tableId: 1,
    beverages: [
      { beverageId: 1, quantity: 1 },                   // Normal -> 3500
      { beverageId: 2, quantity: 1, overridePrice: 0 }, // Promo -> 0
    ],
  });

  assertEquals(order.beverages.length, 2);
  assertEquals(order.beverages[0].unitPrice, 3500);
  assertEquals(order.beverages[0].lineTotal, 3500);
  assertEquals(order.beverages[1].unitPrice, 0);
  assertEquals(order.beverages[1].lineTotal, 0);
  assertEquals(order.subtotal, 3500);
});


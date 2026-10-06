import { Context, RouterContext } from "oak";
import { CreateOrderUseCase, CreateOrderDTO } from "../../application/use-cases/CreateOrderUseCase.ts";
import { GetOrderByIdUseCase } from "../../application/use-cases/GetOrderByIdUseCase.ts";
import { ListOrdersUseCase, ListOrdersDTO } from "../../application/use-cases/ListOrdersUseCase.ts";
import { ChangeOrderStatusUseCase, ChangeOrderStatusDTO } from "../../application/use-cases/ChangeOrderStatusUseCase.ts";
import { CancelOrderUseCase, CancelOrderDTO } from "../../application/use-cases/CancelOrderUseCase.ts";
import { GetKitchenOrdersUseCase } from "../../application/use-cases/GetKitchenOrdersUseCase.ts";
import { DispatchDeliveryOrderUseCase, DispatchDeliveryOrderDTO } from "../../application/use-cases/DispatchDeliveryOrderUseCase.ts";
import { OrderStatusValue } from "../../domain/value-objects/OrderStatus.ts";
import { OrderTypeValue } from "../../domain/value-objects/OrderType.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";
import {
  isStringWithin,
  isNumberInRange,
  isValidEnum,
  isISODateString,
} from "../../../../common/validation.ts";

// Valores de dominio reales para validación de filtros
const VALID_ORDER_STATUSES: readonly OrderStatusValue[] = [
  "PENDIENTE", "CONFIRMADO", "EN_PREPARACION", "LISTO", "EN_CAMINO", "ENTREGADO", "CANCELADO",
];
const VALID_ORDER_TYPES: readonly OrderTypeValue[] = ["MESA", "RECOGER", "DOMICILIO"];

export class OrderController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly listOrdersUseCase: ListOrdersUseCase,
    private readonly changeOrderStatusUseCase: ChangeOrderStatusUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    private readonly getKitchenOrdersUseCase: GetKitchenOrdersUseCase,
    private readonly dispatchDeliveryOrderUseCase: DispatchDeliveryOrderUseCase
  ) {}

  /**
   * POST /api/v1/orders
   * Crea un nuevo pedido.
   * userId de auditoría siempre proviene del JWT (ctx.state.user.id).
   */
  async create(ctx: Context) {
    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    const payload = await body.value;

    // --- Validación de entrada ---
    if (!payload.orderType || typeof payload.orderType !== "string" || payload.orderType.trim() === "") {
      throw new ValidationError("orderType es requerido y debe ser una cadena válida");
    }
    if (!isValidEnum(payload.orderType.toUpperCase(), VALID_ORDER_TYPES)) {
      throw new ValidationError(`orderType inválido. Valores permitidos: ${VALID_ORDER_TYPES.join(", ")}`);
    }

    // tableId: entero positivo si está presente
    if (payload.tableId !== undefined && payload.tableId !== null) {
      const tableId = Number(payload.tableId);
      if (!Number.isInteger(tableId) || tableId <= 0) {
        throw new ValidationError("tableId debe ser un entero positivo");
      }
    }

    // customerId: entero positivo si está presente
    if (payload.customerId !== undefined && payload.customerId !== null) {
      const customerId = Number(payload.customerId);
      if (!Number.isInteger(customerId) || customerId <= 0) {
        throw new ValidationError("customerId debe ser un entero positivo");
      }
    }

    // taxPercentage: número finito entre 0 y 100
    if (payload.taxPercentage !== undefined && payload.taxPercentage !== null) {
      const tax = Number(payload.taxPercentage);
      if (!isNumberInRange(tax, 0, 100)) {
        throw new ValidationError("taxPercentage debe ser un número entre 0 y 100");
      }
      if (Math.round(tax * 100) !== tax * 100) {
        throw new ValidationError("taxPercentage no debe tener más de 2 decimales");
      }
      payload.taxPercentage = tax;
    }

    // discountAmount: número finito >= 0 si está presente
    if (payload.discountAmount !== undefined && payload.discountAmount !== null) {
      const discount = Number(payload.discountAmount);
      if (isNaN(discount) || discount < 0) {
        throw new ValidationError("discountAmount debe ser un número mayor o igual a 0");
      }
      payload.discountAmount = discount;
    }

    // Arrays si están presentes
    if (payload.items !== undefined) {
      if (!Array.isArray(payload.items)) {
        throw new ValidationError("items debe ser un arreglo");
      }
      for (const item of payload.items) {
        if (!item || typeof item !== "object") {
          throw new ValidationError("Cada ítem debe ser un objeto");
        }
        if (!Number.isInteger(item.productId) || item.productId <= 0) {
          throw new ValidationError("productId de un ítem debe ser un entero positivo");
        }
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          throw new ValidationError("quantity de un ítem debe ser un entero positivo");
        }
        if (item.menuType && typeof item.menuType !== "string") {
          throw new ValidationError("menuType de un ítem debe ser una cadena");
        }
        if (item.notes !== undefined && item.notes !== null && !isStringWithin(item.notes, 255)) {
          throw new ValidationError("Las notas de un ítem no deben exceder 255 caracteres");
        }
        if (item.toppings !== undefined) {
          if (!Array.isArray(item.toppings)) throw new ValidationError("toppings debe ser un arreglo");
          for (const t of item.toppings) {
            if (!t || !Number.isInteger(t.toppingId) || t.toppingId <= 0) {
              throw new ValidationError("toppingId debe ser un entero positivo");
            }
            if (t.quantity !== undefined && (!Number.isInteger(t.quantity) || t.quantity < 1)) {
              throw new ValidationError("quantity de un topping debe ser un entero positivo");
            }
          }
        }
      }
    }

    if (payload.beverages !== undefined) {
      if (!Array.isArray(payload.beverages)) {
        throw new ValidationError("beverages debe ser un arreglo");
      }
      for (const bev of payload.beverages) {
        if (!bev || !Number.isInteger(bev.beverageId) || bev.beverageId <= 0) {
          throw new ValidationError("beverageId debe ser un entero positivo");
        }
        if (!Number.isInteger(bev.quantity) || bev.quantity <= 0) {
          throw new ValidationError("quantity de una bebida debe ser un entero positivo");
        }
        if (bev.overridePrice !== undefined && (typeof bev.overridePrice !== "number" || bev.overridePrice < 0)) {
          throw new ValidationError("overridePrice debe ser un número mayor o igual a 0");
        }
      }
    }

    if (payload.combos !== undefined) {
      if (!Array.isArray(payload.combos)) {
        throw new ValidationError("combos debe ser un arreglo");
      }
      for (const combo of payload.combos) {
        if (!combo || !Number.isInteger(combo.comboId) || combo.comboId <= 0) {
          throw new ValidationError("comboId debe ser un entero positivo");
        }
        if (!Number.isInteger(combo.quantity) || combo.quantity <= 0) {
          throw new ValidationError("quantity de un combo debe ser un entero positivo");
        }
      }
    }

    // Longitudes de strings
    if (payload.deliveryAddress !== undefined && payload.deliveryAddress !== null) {
      if (!isStringWithin(payload.deliveryAddress, 255)) {
        throw new ValidationError("deliveryAddress no debe exceder 255 caracteres");
      }
    }
    if (payload.notes !== undefined && payload.notes !== null) {
      if (!isStringWithin(payload.notes, 255)) {
        throw new ValidationError("notes no debe exceder 255 caracteres");
      }
    }

    // userId: siempre del JWT — no se acepta del payload por seguridad
    const authUser = (ctx.state as any).user;

    const dto: CreateOrderDTO = {
      userId: authUser.id,         // SIEMPRE del JWT
      orderType: payload.orderType.toUpperCase() as OrderTypeValue,
      tableId: payload.tableId ? Number(payload.tableId) : undefined,
      customerId: payload.customerId ? Number(payload.customerId) : undefined,
      deliveryAddress: payload.deliveryAddress,
      deliveryUserId: payload.deliveryUserId ? Number(payload.deliveryUserId) : undefined,
      items: payload.items ?? [],
      beverages: (payload.beverages ?? []).map((b: any) => ({
        beverageId: Number(b.beverageId),
        quantity: Number(b.quantity),
        overridePrice: b.overridePrice !== undefined ? Number(b.overridePrice) : undefined,
      })),
      combos: payload.combos ?? [],
      notes: payload.notes,
      taxPercentage: payload.taxPercentage,
      discountAmount: payload.discountAmount,
      sendToKitchen: payload.sendToKitchen === true,
    };

    const order = await this.createOrderUseCase.execute(dto);

    ctx.response.status = 201;
    ctx.response.body = {
      message: "Pedido creado exitosamente",
      data: this.serializeOrder(order),
    };
  }

  /**
   * GET /api/v1/orders
   * Lista pedidos con filtros opcionales vía query params.
   * userId es un filtro de negocio legítimo (filtrar por mesero), no identidad de auditoría.
   */
  async listAll(ctx: Context) {
    const url = ctx.request.url;

    // --- Validación de query params ---
    const customerIdParam = url.searchParams.get("customerId");
    if (customerIdParam !== null) {
      const n = Number(customerIdParam);
      if (!Number.isInteger(n) || n <= 0 || n > 1e9) {
        throw new ValidationError("customerId debe ser un entero positivo");
      }
    }

    // userId como filtro de negocio: filtra pedidos por mesero — no reemplaza identidad JWT
    const userIdParam = url.searchParams.get("userId");
    if (userIdParam !== null) {
      const n = Number(userIdParam);
      if (!Number.isInteger(n) || n <= 0 || n > 1e9) {
        throw new ValidationError("userId debe ser un entero positivo");
      }
    }

    const limitParam = url.searchParams.get("limit");
    const limit = limitParam !== null ? Number(limitParam) : 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new ValidationError("limit debe ser un entero entre 1 y 200");
    }

    const offsetParam = url.searchParams.get("offset");
    const offset = offsetParam !== null ? Number(offsetParam) : 0;
    if (!Number.isInteger(offset) || offset < 0 || offset > 1e9) {
      throw new ValidationError("offset debe ser un entero >= 0");
    }

    const dateFrom = url.searchParams.get("dateFrom");
    if (dateFrom !== null && !isISODateString(dateFrom)) {
      throw new ValidationError("dateFrom debe ser una fecha ISO válida (ej. 2024-01-15)");
    }

    const dateTo = url.searchParams.get("dateTo");
    if (dateTo !== null && !isISODateString(dateTo)) {
      throw new ValidationError("dateTo debe ser una fecha ISO válida (ej. 2024-01-15)");
    }

    if (dateFrom !== null && dateTo !== null) {
      if (new Date(dateFrom) > new Date(dateTo)) {
        throw new ValidationError("dateFrom no puede ser mayor que dateTo");
      }
    }

    const statusParam = url.searchParams.get("status");
    if (statusParam !== null && !isValidEnum(statusParam as OrderStatusValue, VALID_ORDER_STATUSES)) {
      throw new ValidationError(`status inválido. Valores permitidos: ${VALID_ORDER_STATUSES.join(", ")}`);
    }

    const orderTypeParam = url.searchParams.get("orderType");
    if (orderTypeParam !== null && !isValidEnum(orderTypeParam as OrderTypeValue, VALID_ORDER_TYPES)) {
      throw new ValidationError(`orderType inválido. Valores permitidos: ${VALID_ORDER_TYPES.join(", ")}`);
    }

    const dto: ListOrdersDTO = {
      status: statusParam as OrderStatusValue | undefined ?? undefined,
      orderType: orderTypeParam as OrderTypeValue | undefined ?? undefined,
      customerId: customerIdParam !== null ? Number(customerIdParam) : undefined,
      userId: userIdParam !== null ? Number(userIdParam) : undefined,
      dateFrom: dateFrom ?? undefined,
      dateTo: dateTo ?? undefined,
      limit,
      offset,
    };

    const orders = await this.listOrdersUseCase.execute(dto);

    ctx.response.status = 200;
    ctx.response.body = {
      data: orders.map((o) => this.serializeOrder(o)),
      meta: {
        limit: dto.limit,
        offset: dto.offset,
        count: orders.length,
      },
    };
  }

  /**
   * GET /api/v1/orders/kitchen
   * Obtiene los pedidos activos para la pantalla de cocina (KDS).
   * Query params: ?activeOnly=true|false (default: false -> incluye LISTO)
   */
  async getKitchenOrders(ctx: Context) {
    const url = ctx.request.url;
    const activeOnlyParam = url.searchParams.get("activeOnly");
    const activeOnly = activeOnlyParam !== null ? activeOnlyParam === "true" : false;

    const orders = await this.getKitchenOrdersUseCase.execute({ activeOnly });

    ctx.response.status = 200;
    ctx.response.body = {
      data: orders.map((o) => this.serializeOrder(o)),
      meta: {
        count: orders.length,
      },
    };
  }

  /**
   * GET /api/v1/orders/:id
   * Obtiene un pedido por ID con todos sus ítems, bebidas, combos y toppings.
   */
  async findById(ctx: RouterContext<"/api/v1/orders/:id">) {
    const id = Number(ctx.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError("El ID del pedido debe ser un entero positivo");
    }
    const order = await this.getOrderByIdUseCase.execute(id);

    ctx.response.status = 200;
    ctx.response.body = {
      data: this.serializeOrder(order),
    };
  }

  /**
   * PATCH /api/v1/orders/:id/status
   * Cambia el estado de un pedido.
   * changedBy es inyectado exclusivamente desde el JWT — no puede ser enviado por el cliente.
   */
  async changeStatus(ctx: RouterContext<"/api/v1/orders/:id/status">) {
    const id = Number(ctx.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError("El ID del pedido debe ser un entero positivo");
    }

    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    const payload = await body.value;
    const authUser = (ctx.state as any).user;

    if (!payload.newStatus || typeof payload.newStatus !== "string") {
      throw new ValidationError("newStatus es requerido");
    }
    if (payload.notes !== undefined && payload.notes !== null && !isStringWithin(payload.notes, 255)) {
      throw new ValidationError("notes no debe exceder 255 caracteres");
    }

    const dto: ChangeOrderStatusDTO = {
      orderId: id,
      newStatus: payload.newStatus,
      changedBy: authUser.id,     // SIEMPRE del JWT — campo de auditoría
      notes: payload.notes,
    };

    const order = await this.changeOrderStatusUseCase.execute(dto);

    ctx.response.status = 200;
    ctx.response.body = {
      message: `Estado del pedido actualizado a '${order.status.value}'`,
      data: this.serializeOrder(order),
    };
  }

  /**
   * PATCH /api/v1/orders/:id/cancel
   * Cancela un pedido con motivo obligatorio.
   * cancelledBy es inyectado exclusivamente desde el JWT — no puede ser enviado por el cliente.
   */
  async cancel(ctx: RouterContext<"/api/v1/orders/:id/cancel">) {
    const id = Number(ctx.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError("El ID del pedido debe ser un entero positivo");
    }

    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    const payload = await body.value;
    const authUser = (ctx.state as any).user;

    if (!payload.reason || typeof payload.reason !== "string" || payload.reason.trim() === "") {
      throw new ValidationError("reason es requerido para cancelar un pedido");
    }
    if (!isStringWithin(payload.reason, 500)) {
      throw new ValidationError("reason no debe exceder 500 caracteres");
    }

    const dto: CancelOrderDTO = {
      orderId: id,
      cancelledBy: authUser.id,   // SIEMPRE del JWT — campo de auditoría
      reason: payload.reason,
    };

    const order = await this.cancelOrderUseCase.execute(dto);

    ctx.response.status = 200;
    ctx.response.body = {
      message: `Pedido #${order.orderNumber} cancelado exitosamente`,
      data: this.serializeOrder(order),
    };
  }

  // ─── Serialización ────────────────────────────────────────────────────────
  // Convierte la entidad Order en un objeto plano JSON-serializable.

  private serializeOrder(order: any): object {
    const dailyNum = order.dailyOrderNumber !== undefined && order.dailyOrderNumber !== null
      ? Number(order.dailyOrderNumber)
      : null;
    const displayNum = order.displayOrderNumber
      ? order.displayOrderNumber
      : (dailyNum ? `PEDIDO ${dailyNum}` : order.orderNumber);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate ?? null,
      dailyOrderNumber: dailyNum,
      displayOrderNumber: displayNum,
      customerId: order.customerId,
      customerName: order.customerName ?? null,
      userId: order.userId,
      orderType: order.orderType?.value ?? order.orderType ?? null,
      tableId: order.tableId,
      deliveryAddress: order.deliveryAddress,
      deliveryUserId: order.deliveryUserId,
      deliveryCompany: order.deliveryCompany ?? null,
      status: order.status?.value ?? order.status ?? null,
      promotionId: order.promotionId,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      disposableFee: order.disposableFee,
      total: order.total,
      notes: order.notes,
      createdAt: order.createdAt?.toISOString() ?? null,
      updatedAt: order.updatedAt?.toISOString() ?? null,
      paidAt: order.paidAt?.toISOString() ?? null,
      kitchenStartedAt: order.kitchenStartedAt?.toISOString() ?? null,
      items: (order.items ?? []).map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName ?? null,
        orderComboId: item.orderComboId,
        quantity: item.quantity,
        menuType: item.menuType,
        unitPrice: item.unitPrice,
        toppingsExtraPrice: item.toppingsExtraPrice,
        lineTotal: item.lineTotal,
        notes: item.notes,
        toppings: (item.toppings ?? []).map((t: any) => ({
          id: t.id,
          toppingId: t.toppingId,
          toppingName: t.toppingName,
          quantity: t.quantity,
          extraPrice: t.extraPrice,
          lineTotal: t.lineTotal,
        })),
      })),
      beverages: (order.beverages ?? []).map((b: any) => ({
        id: b.id,
        beverageId: b.beverageId,
        beverageName: b.beverageName ?? null,
        orderComboId: b.orderComboId,
        quantity: b.quantity,
        unitPrice: b.unitPrice,
        lineTotal: b.lineTotal,
      })),
      combos: (order.combos ?? []).map((c: any) => ({
        id: c.id,
        comboId: c.comboId,
        comboName: c.comboName,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        lineTotal: c.lineTotal,
      })),
    };
  }

  /**
   * PATCH /api/v1/orders/:id/dispatch
   * Despacha un pedido a un domiciliario.
   */
  async dispatchDeliveryOrder(ctx: RouterContext<string, { id: string }, Record<string, any>>) {
    const orderId = Number(ctx.params.id);
    if (isNaN(orderId) || orderId <= 0) {
      throw new ValidationError("ID de pedido inválido");
    }

    const body = ctx.request.body({ type: "json" });
    const payload = await body.value;

    const deliveryUserId = payload.deliveryUserId ? Number(payload.deliveryUserId) : undefined;
    const deliveryCompany = typeof payload.deliveryCompany === "string" && payload.deliveryCompany.trim() !== "" 
      ? payload.deliveryCompany.trim() 
      : undefined;

    if (!deliveryUserId && !deliveryCompany) {
      throw new ValidationError("Debe especificar deliveryUserId o deliveryCompany");
    }

    const user = ctx.state.user;

    const dto: DispatchDeliveryOrderDTO = {
      orderId,
      deliveryUserId,
      deliveryCompany,
      changedBy: user.id
    };

    const updatedOrder = await this.dispatchDeliveryOrderUseCase.execute(dto);

    ctx.response.status = 200;
    ctx.response.body = this.serializeOrder(updatedOrder);
  }
}

import { Order } from "../../domain/Order.ts";
import { OrderItem } from "../../domain/OrderItem.ts";
import { OrderItemTopping } from "../../domain/OrderItemTopping.ts";
import { OrderBeverage } from "../../domain/OrderBeverage.ts";
import { OrderCombo } from "../../domain/OrderCombo.ts";
import { OrderRepository } from "../../domain/OrderRepository.ts";
import { OrderEventPublisher } from "../../domain/OrderEventPublisher.ts";
import { MenuToppingRuleRepository } from "../../domain/MenuToppingRuleRepository.ts";
import { OrderType } from "../../domain/value-objects/OrderType.ts";
import { OrderStatus } from "../../domain/value-objects/OrderStatus.ts";
import { MenuType, MenuTypeValue } from "../../domain/value-objects/MenuType.ts";
import { ValidationError, NotFoundError } from "../../../../shared/domain/error.ts";

// ─── Interfaces de los repositorios de catálogo (consulta de precios) ────────
// Definimos interfaces mínimas aquí para no acoplar al módulo catalog directamente.
// Esto facilita la substitución en tests y futuras integraciones.

export interface ProductSnapshot {
  id: number;
  name: string;
  priceUniversitario: number | null;
  priceEspecial: number | null;
  hasToppings: boolean;
  availableIn: string;
  isActive: boolean;
}

export interface ToppingSnapshot {
  id: number;
  name: string;
  extraPrice: number;
  isActive: boolean;
}

export interface BeverageSnapshot {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
}

export interface ComboSnapshot {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
}

export interface AllowedToppingForProduct {
  productId: number;
  toppingId: number;
}

/** Repositorios de catálogo requeridos por este caso de uso */
export interface CatalogQueryPorts {
  findProductById(id: number): Promise<ProductSnapshot | null>;
  findToppingById(id: number): Promise<ToppingSnapshot | null>;
  findBeverageById(id: number): Promise<BeverageSnapshot | null>;
  findComboById(id: number): Promise<ComboSnapshot | null>;
  findAllowedToppingsForProduct(productId: number): Promise<AllowedToppingForProduct[]>;
}

// ─── DTOs de entrada ──────────────────────────────────────────────────────────

export interface ToppingInputDTO {
  toppingId: number;
  quantity?: number;
}

export interface OrderItemInputDTO {
  productId: number;
  quantity: number;
  menuType: MenuTypeValue;
  toppings?: ToppingInputDTO[];
  notes?: string;
  productName?: string; // optional promo name
}

export interface OrderBeverageInputDTO {
  beverageId: number;
  quantity: number;
  overridePrice?: number;
}

export interface OrderComboInputDTO {
  comboId: number;
  quantity: number;
}

export interface CreateOrderDTO {
  userId: number;
  orderType: string;               // 'MESA' | 'RECOGER' | 'DOMICILIO'
  tableId?: number;                // Requerido si MESA
  customerId?: number;             // Requerido si DOMICILIO
  deliveryAddress?: string;        // Requerido si DOMICILIO
  deliveryUserId?: number;
  items?: OrderItemInputDTO[];
  beverages?: OrderBeverageInputDTO[];
  combos?: OrderComboInputDTO[];
  notes?: string;
  taxPercentage?: number;          // Porcentaje de impuesto (default 0)
  discountAmount?: number;         // Descuento promocional explícito (>= 0)
  sendToKitchen?: boolean;         // Avanzar a CONFIRMADO inmediatamente
  // [EXTENSION POINT] promotionCode?: string;  // Módulo Promociones
}

// ─── Caso de Uso ─────────────────────────────────────────────────────────────

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly menuToppingRuleRepository: MenuToppingRuleRepository,
    private readonly catalogPorts: CatalogQueryPorts,
    private readonly eventPublisher?: OrderEventPublisher
  ) {}

  async execute(dto: CreateOrderDTO): Promise<Order> {
    // 1. Validar tipo de pedido
    const orderType = OrderType.create(dto.orderType);

    // 2. Validar invariantes de tipo antes de consultas costosas
    this.validateOrderTypeRequirements(dto, orderType);

    // 3. Procesar ítems de producto
    const { items, itemsSubtotal } = await this.processItems(dto.items ?? []);

    // 4. Procesar bebidas independientes
    const { beverages, beveragesSubtotal } = await this.processBeverages(dto.beverages ?? []);

    // 5. Procesar combos
    const { combos, combosSubtotal } = await this.processCombos(dto.combos ?? []);

    // 6. Calcular totales
    const subtotal = itemsSubtotal + beveragesSubtotal + combosSubtotal;
    const taxPercentage = dto.taxPercentage ?? 0;
    const taxAmount = Math.round((subtotal * (taxPercentage / 100)) * 100) / 100;
    const discountAmount = Math.max(0, Number(dto.discountAmount) || 0);

    // Regla de Desechables: MESA = $0, RECOGER (Para llevar) = $1.000, DOMICILIO = $1.000 (único por pedido)
    const disposableFee = (orderType.isRecoger() || orderType.isDomicilio()) ? 1000 : 0;

    const total = Math.max(0, subtotal + taxAmount + disposableFee - discountAmount);

    // 7. Generar número de orden único
    const orderNumber = this.generateOrderNumber();

    // 8. Construir el Order aggregate
    const order = new Order(
      null,
      orderNumber,
      dto.customerId ?? null,
      dto.userId,
      orderType,
      dto.tableId ?? null,
      dto.deliveryAddress ?? null,
      dto.deliveryUserId ?? null,
      null, // deliveryCompany (se asigna al despachar)
      OrderStatus.initial(),
      null, // promotionId — [EXTENSION POINT] Módulo Promociones
      subtotal,
      discountAmount,
      taxAmount,
      disposableFee,
      total,
      dto.notes ?? null,
      null, // createdAt
      null, // updatedAt
      null, // paidAt
      null, // kitchenStartedAt
      items,
      beverages,
      combos
    );

    // 9. Si sendToKitchen es true, avanzar estado a CONFIRMADO inmediatamente
    if (dto.sendToKitchen) {
      order.transitionStatus("CONFIRMADO");
    }

    // 10. Persistir la orden (con su nuevo estado si se avanzó)
    const savedOrder = await this.orderRepository.save(order);

    // ─────────────────────────────────────────────────────────────────────────
    // [EXTENSION POINT] Kitchen Display System (KDS) & Tiempo Real
    this.eventPublisher?.notifyOrderCreated(savedOrder);
    // ─────────────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────────
    // [EXTENSION POINT] Inventario — descontar ingredientes por receta
    // await this.inventoryService.consumeForOrder(savedOrder);
    // ─────────────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────────
    // [EXTENSION POINT] Fidelización — no acumular hasta ENTREGADO
    // Se acumula en ChangeOrderStatusUseCase cuando status → ENTREGADO
    // ─────────────────────────────────────────────────────────────────────────

    return savedOrder;
  }

  // ─── Validación de invariantes por tipo de pedido ──────────────────────────

  private validateOrderTypeRequirements(dto: CreateOrderDTO, orderType: OrderType): void {
    if (orderType.isMesa() && !dto.tableId) {
      throw new ValidationError("Los pedidos tipo MESA requieren tableId");
    }
    if (orderType.isDomicilio()) {
      if (!dto.deliveryAddress || dto.deliveryAddress.trim().length === 0) {
        throw new ValidationError("Los pedidos tipo DOMICILIO requieren deliveryAddress");
      }
      // customerId es opcional: permite domicilios a clientes sin cuenta registrada.
      // Si se proporciona, la orden quedará asociada al cliente para historial y fidelización.
    }

    const totalLines = (dto.items?.length ?? 0) + (dto.beverages?.length ?? 0) + (dto.combos?.length ?? 0);
    if (totalLines === 0) {
      throw new ValidationError("El pedido debe tener al menos un ítem, bebida o combo");
    }
  }

  // ─── Procesamiento de ítems ────────────────────────────────────────────────

  private async processItems(
    itemDTOs: OrderItemInputDTO[]
  ): Promise<{ items: OrderItem[]; itemsSubtotal: number }> {
    const items: OrderItem[] = [];
    let itemsSubtotal = 0;

    for (const dto of itemDTOs) {
      // Validar que el producto existe y está activo
      const product = await this.catalogPorts.findProductById(dto.productId);
      if (!product) {
        throw new NotFoundError(`Producto con ID ${dto.productId} no encontrado`);
      }
      if (!product.isActive) {
        throw new ValidationError(`El producto '${product.name}' (ID: ${dto.productId}) no está activo`);
      }

      // Validar que el producto está disponible en el menú solicitado
      const menuType = MenuType.create(dto.menuType);
      this.validateProductMenuAvailability(product, menuType.value);

      // Capturar precio histórico (NUNCA se recalcula después)
      const unitPrice = this.resolveProductPrice(product, menuType.value);

      // Procesar toppings
      const { toppings, toppingsExtraPrice } = await this.processToppings(
        dto.toppings ?? [],
        dto.productId,
        product,
        menuType.value
      );

      const item = new OrderItem(
        null,
        null, // orderId — se asignará al persistir
        dto.productId,
        null, // orderComboId — null para ítems independientes
        dto.quantity,
        menuType.value,
        unitPrice,
        toppingsExtraPrice,
        dto.notes ?? null,
        toppings,
        dto.productName ?? null
      );

      items.push(item);
      itemsSubtotal += item.lineTotal;
    }

    return { items, itemsSubtotal };
  }

  // ─── Procesamiento de toppings por ítem ───────────────────────────────────

  private async processToppings(
    toppingDTOs: ToppingInputDTO[],
    productId: number,
    product: ProductSnapshot,
    menuType: MenuTypeValue
  ): Promise<{ toppings: OrderItemTopping[]; toppingsExtraPrice: number }> {
    if (toppingDTOs.length === 0) {
      return { toppings: [], toppingsExtraPrice: 0 };
    }

    if (!product.hasToppings) {
      throw new ValidationError(
        `El producto '${product.name}' (ID: ${productId}) no admite toppings`
      );
    }

    // Obtener toppings permitidos para el producto
    const allowedToppings = await this.catalogPorts.findAllowedToppingsForProduct(productId);
    const allowedToppingIds = new Set(allowedToppings.map((a) => a.toppingId));

    const toppings: OrderItemTopping[] = [];
    let explicitToppingsExtraPrice = 0;
    let normalToppingsCount = 0;

    for (const dto of toppingDTOs) {
      // Validar que el topping está permitido para este producto
      if (!allowedToppingIds.has(dto.toppingId)) {
        throw new ValidationError(
          `El topping con ID ${dto.toppingId} no está permitido para el producto '${product.name}'`
        );
      }

      // Validar que el topping existe y está activo
      const topping = await this.catalogPorts.findToppingById(dto.toppingId);
      if (!topping) {
        throw new NotFoundError(`Topping con ID ${dto.toppingId} no encontrado`);
      }
      if (!topping.isActive) {
        throw new ValidationError(`El topping '${topping.name}' (ID: ${dto.toppingId}) no está activo`);
      }

      // Validar que no se aplique Combo Universitario a ítems de Menú Especial
      const isComboUniversitario = topping.name.toLowerCase().includes("combo universitario");
      if (menuType === "ESPECIAL" && isComboUniversitario) {
        throw new ValidationError("Los productos del Menú Especial no admiten el Combo Universitario");
      }

      const qty = dto.quantity ?? 1;

      if (!isComboUniversitario) {
        normalToppingsCount += qty;
      }

      // En Menú Especial los toppings son gratuitos e ilimitados (a menos que no sea un topping estándar)
      const effectiveExtraPrice = (menuType === "ESPECIAL" && !isComboUniversitario) ? 0 : topping.extraPrice;

      // Capturar precio histórico del topping
      const orderTopping = new OrderItemTopping(
        null,
        null, // orderItemId — se asignará al persistir
        dto.toppingId,
        topping.name,            // Nombre histórico (snapshot)
        qty,
        effectiveExtraPrice      // Precio histórico (snapshot)
      );

      toppings.push(orderTopping);
      explicitToppingsExtraPrice += orderTopping.lineTotal;
    }

    // Regla de recargo por toppings adicionales en Menú Universitario:
    // Primeros 4 toppings incluidos ($0). A partir del 5º: +$1.000 por cada topping adicional.
    const extraToppingsCount = menuType === "UNIVERSITARIO" ? Math.max(0, normalToppingsCount - 4) : 0;
    const extraToppingsSurcharge = extraToppingsCount * 1000;

    const toppingsExtraPrice = explicitToppingsExtraPrice + extraToppingsSurcharge;

    return { toppings, toppingsExtraPrice };
  }

  // ─── Procesamiento de bebidas independientes ───────────────────────────────

  private async processBeverages(
    beverageDTOs: OrderBeverageInputDTO[]
  ): Promise<{ beverages: OrderBeverage[]; beveragesSubtotal: number }> {
    const beverages: OrderBeverage[] = [];
    let beveragesSubtotal = 0;

    for (const dto of beverageDTOs) {
      const beverage = await this.catalogPorts.findBeverageById(dto.beverageId);
      if (!beverage) {
        throw new NotFoundError(`Bebida con ID ${dto.beverageId} no encontrada`);
      }
      if (!beverage.isActive) {
        throw new ValidationError(`La bebida '${beverage.name}' (ID: ${dto.beverageId}) no está activa`);
      }

      const unitPrice = (dto.overridePrice !== undefined && dto.overridePrice >= 0)
        ? dto.overridePrice
        : beverage.price;

      const orderBeverage = new OrderBeverage(
        null,
        null, // orderId — se asignará al persistir
        dto.beverageId,
        null, // orderComboId — null para bebidas independientes
        dto.quantity,
        unitPrice  // Precio histórico (snapshot)
      );

      beverages.push(orderBeverage);
      beveragesSubtotal += orderBeverage.lineTotal;
    }

    return { beverages, beveragesSubtotal };
  }

  // ─── Procesamiento de combos ───────────────────────────────────────────────

  private async processCombos(
    comboDTOs: OrderComboInputDTO[]
  ): Promise<{ combos: OrderCombo[]; combosSubtotal: number }> {
    const combos: OrderCombo[] = [];
    let combosSubtotal = 0;

    for (const dto of comboDTOs) {
      const combo = await this.catalogPorts.findComboById(dto.comboId);
      if (!combo) {
        throw new NotFoundError(`Combo con ID ${dto.comboId} no encontrado`);
      }
      if (!combo.isActive) {
        throw new ValidationError(`El combo '${combo.name}' (ID: ${dto.comboId}) no está activo`);
      }

      // Validar vigencia del combo
      const now = new Date();
      if (combo.validFrom && now < combo.validFrom) {
        throw new ValidationError(`El combo '${combo.name}' aún no está vigente`);
      }
      if (combo.validUntil && now > combo.validUntil) {
        throw new ValidationError(`El combo '${combo.name}' ha expirado`);
      }

      // Los ítems y bebidas del combo se persisten con la referencia orderComboId
      // Sus precios individuales están en las tablas de combo_products y combo_beverages
      // Para el precio del pedido se usa el precio total del combo (snapshot)
      const orderCombo = new OrderCombo(
        null,
        null, // orderId — se asignará al persistir
        dto.comboId,
        combo.name,   // Nombre histórico (snapshot)
        dto.quantity,
        combo.price,  // Precio histórico (snapshot)
        [],           // Los ítems internos se manejan con orderComboId en la BD
        []            // Las bebidas internas se manejan con orderComboId en la BD
      );

      combos.push(orderCombo);
      combosSubtotal += orderCombo.lineTotal;
    }

    return { combos, combosSubtotal };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private validateProductMenuAvailability(product: ProductSnapshot, menuType: MenuTypeValue): void {
    const available = product.availableIn;

    if (menuType === "UNIVERSITARIO" && available === "ESPECIAL") {
      throw new ValidationError(
        `El producto '${product.name}' solo está disponible en Menú Especial, no en Universitario`
      );
    }
    if (menuType === "ESPECIAL" && available === "UNIVERSITARIO") {
      throw new ValidationError(
        `El producto '${product.name}' solo está disponible en Menú Universitario, no en Especial`
      );
    }
  }

  private resolveProductPrice(product: ProductSnapshot, menuType: MenuTypeValue): number {
    if (menuType === "UNIVERSITARIO") {
      if (product.priceUniversitario === null) {
        throw new ValidationError(
          `El producto '${product.name}' no tiene precio para Menú Universitario`
        );
      }
      return product.priceUniversitario;
    } else {
      if (product.priceEspecial === null) {
        throw new ValidationError(
          `El producto '${product.name}' no tiene precio para Menú Especial`
        );
      }
      return product.priceEspecial;
    }
  }

  /**
   * Genera un número de orden único en formato ORD-YYYYMMDD-<random6>.
   * En producción se recomienda usar un contador atómico de la BD.
   */
  private generateOrderNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(100000 + Math.random() * 900000).toString();
    return `ORD-${date}-${random}`;
  }
}

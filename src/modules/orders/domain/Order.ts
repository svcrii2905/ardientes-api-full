import { ValidationError } from "../../../shared/domain/error.ts";
import { OrderType } from "./value-objects/OrderType.ts";
import { OrderStatus, OrderStatusValue } from "./value-objects/OrderStatus.ts";
import { OrderItem } from "./OrderItem.ts";
import { OrderBeverage } from "./OrderBeverage.ts";
import { OrderCombo } from "./OrderCombo.ts";

/**
 * Entidad raíz (Aggregate Root) del módulo Orders.
 * 
 * Invariantes de dominio:
 * - MESA: tableId obligatorio, sin deliveryAddress.
 * - DOMICILIO: deliveryAddress obligatoria, customerId opcional (cliente sin cuenta), sin tableId.
 * - RECOGER: sin tableId ni deliveryAddress.
 * - Los precios se capturan al crearse el pedido y nunca se recalculan.
 * - Solo se puede cancelar si el estado es PENDIENTE o EN_PREPARACION.
 * 
 * Extension points preparados para integración futura:
 * - promotionId: campo listo para módulo Promociones
 * - discountAmount: campo listo para aplicar descuentos
 * - Método onCreated(): hook para KDS, Inventario, Fidelización
 */
export class Order {
  constructor(
    public readonly id: number | null,
    public readonly orderNumber: string,
    public readonly customerId: number | null,
    public readonly userId: number,
    public readonly orderType: OrderType,
    public readonly tableId: number | null,
    public readonly deliveryAddress: string | null,
    public deliveryUserId: number | null,
    public deliveryCompany: string | null,
    public status: OrderStatus,
    public readonly promotionId: number | null, // [EXTENSION POINT] Módulo Promociones
    public readonly subtotal: number,
    public readonly discountAmount: number,     // [EXTENSION POINT] Módulo Promociones
    public readonly taxAmount: number,
    public readonly disposableFee: number = 0,
    public readonly total: number,
    public readonly notes: string | null,
    public readonly createdAt: Date | null,
    public readonly updatedAt: Date | null,
    public readonly paidAt: Date | null,
    public kitchenStartedAt: Date | null = null,
    public readonly items: OrderItem[] = [],
    public readonly beverages: OrderBeverage[] = [],
    public readonly combos: OrderCombo[] = [],
    public readonly customerName: string | null = null,
    skipValidation = false,
    public readonly orderDate: string | null = null,
    public readonly dailyOrderNumber: number | null = null
  ) {
    if (!skipValidation) {
      this.validateInvariants();
    }
  }

  get displayOrderNumber(): string {
    if (this.dailyOrderNumber !== null && this.dailyOrderNumber !== undefined) {
      return `PEDIDO ${this.dailyOrderNumber}`;
    }
    return this.orderNumber;
  }

  private validateInvariants(): void {
    if (!this.orderNumber || this.orderNumber.trim().length === 0) {
      throw new ValidationError("El número de pedido no puede estar vacío");
    }
    if (!this.userId) {
      throw new ValidationError("El pedido debe tener un cajero asignado (userId)");
    }

    // Validar invariantes por tipo de pedido
    if (this.orderType.isMesa()) {
      if (!this.tableId) {
        throw new ValidationError("Los pedidos tipo MESA requieren un tableId");
      }
      if (this.deliveryAddress) {
        throw new ValidationError("Los pedidos tipo MESA no pueden tener dirección de domicilio");
      }
    }

    if (this.orderType.isDomicilio()) {
      if (!this.deliveryAddress || this.deliveryAddress.trim().length === 0) {
        throw new ValidationError("Los pedidos tipo DOMICILIO requieren dirección de entrega");
      }
      // customerId es opcional: permite domicilios a clientes sin cuenta registrada.
      // Si se proporciona, la orden queda asociada al cliente para historial y fidelización.
      if (this.tableId) {
        throw new ValidationError("Los pedidos tipo DOMICILIO no pueden tener mesa asignada");
      }
    }

    if (this.orderType.isRecoger()) {
      if (this.tableId) {
        throw new ValidationError("Los pedidos tipo RECOGER no pueden tener mesa asignada");
      }
      if (this.deliveryAddress) {
        throw new ValidationError("Los pedidos tipo RECOGER no pueden tener dirección de domicilio");
      }
    }

    if (this.subtotal < 0) {
      throw new ValidationError("El subtotal no puede ser negativo");
    }
    if (this.disposableFee < 0) {
      throw new ValidationError("El cargo de desechables no puede ser negativo");
    }
    if (this.total < 0) {
      throw new ValidationError("El total no puede ser negativo");
    }

    const hasItems = this.items.length > 0 || this.beverages.length > 0 || this.combos.length > 0;
    if (!hasItems) {
      throw new ValidationError("El pedido debe tener al menos un ítem, bebida o combo");
    }
  }

  /**
   * Cambia el estado del pedido aplicando la máquina de estados de OrderStatus.
   * Lanza ValidationError si la transición no es válida.
   */
  transitionStatus(newStatus: OrderStatusValue): void {
    this.status = this.status.transitionTo(newStatus);
    if ((newStatus === "CONFIRMADO" || newStatus === "EN_PREPARACION") && !this.kitchenStartedAt) {
      this.markKitchenStarted();
    }
  }

  /**
   * Registra el momento en que el pedido entra a cocina.
   * Invariante: Una vez establecido, no se sobreescribe.
   */
  markKitchenStarted(timestamp: Date = new Date()): void {
    if (!this.kitchenStartedAt) {
      this.kitchenStartedAt = timestamp;
    }
  }

  /**
   * Cancela el pedido. Solo es posible desde PENDIENTE o EN_PREPARACION.
   */
  cancel(): void {
    this.transitionStatus("CANCELADO");
  }

  /**
   * Verifica si el pedido puede ser cancelado.
   */
  canBeCancelled(): boolean {
    return this.status.canTransitionTo("CANCELADO");
  }

  // -------------------------------------------------------------------------
  // [EXTENSION POINT] Kitchen Display System (KDS)
  // Al integrar KDS, llamar este método después de guardar el pedido.
  // onCreated(): void { /* Publicar evento OrderCreated al bus */ }
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // [EXTENSION POINT] Inventario
  // Al integrar Inventario, descontar stock de recipe_ingredients aquí.
  // onCreated(): void { /* Llamar InventoryService.consumeForOrder(this) */ }
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // [EXTENSION POINT] Fidelización (Loyalty)
  // Al integrar Loyalty, acumular puntos cuando estado → ENTREGADO.
  // onStatusChanged(newStatus): void { /* Llamar LoyaltyService.award(this) */ }
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // [EXTENSION POINT] Promociones
  // Al integrar Promociones, aplicar descuento antes de calcular total.
  // applyPromotion(promotion): void { /* Recalcular discountAmount y total */ }
  // -------------------------------------------------------------------------
}

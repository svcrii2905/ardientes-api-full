import { Context } from "oak";
import { ListInventoryItemsUseCase } from "../../application/use-cases/ListInventoryItemsUseCase.ts";
import { GetLowStockItemsUseCase } from "../../application/use-cases/GetLowStockItemsUseCase.ts";
import { RegisterMovementUseCase, RegisterMovementDTO } from "../../application/use-cases/RegisterMovementUseCase.ts";
import { ListMovementsUseCase } from "../../application/use-cases/ListMovementsUseCase.ts";
import { MovementType } from "../../domain/InventoryMovement.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";
import { isStringWithin, isValidEnum } from "../../../../common/validation.ts";

export class InventoryController {
  constructor(
    private readonly listInventoryItemsUseCase: ListInventoryItemsUseCase,
    private readonly getLowStockItemsUseCase: GetLowStockItemsUseCase,
    private readonly registerMovementUseCase: RegisterMovementUseCase,
    private readonly listMovementsUseCase: ListMovementsUseCase
  ) {}

  /**
   * GET /api/v1/inventory/items
   */
  async getItems(ctx: Context) {
    const activeOnlyParam = ctx.request.url.searchParams.get("activeOnly");
    const activeOnly = activeOnlyParam === "false" ? false : true;

    const items = await this.listInventoryItemsUseCase.execute(activeOnly);

    ctx.response.status = 200;
    ctx.response.body = {
      data: items.map((item) => this.serializeItem(item)),
      count: items.length,
    };
  }

  /**
   * GET /api/v1/inventory/items/low-stock
   */
  async getLowStockItems(ctx: Context) {
    const items = await this.getLowStockItemsUseCase.execute();

    ctx.response.status = 200;
    ctx.response.body = {
      data: items.map((item) => this.serializeItem(item)),
      count: items.length,
    };
  }

  /**
   * POST /api/v1/inventory/movements
   */
  async registerMovement(ctx: Context) {
    const body = ctx.request.body({ type: "json", limit: 1_048_576 });
    const payload = await body.value;
    const authUser = (ctx.state as any).user;

    // --- Validación de entrada ---
    // Tipos de movimiento reales definidos en el dominio
    const VALID_MOVEMENT_TYPES: readonly MovementType[] = ["ENTRADA", "SALIDA", "AJUSTE", "MERMA"];

    const itemId = Number(payload.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new ValidationError("itemId debe ser un entero positivo");
    }

    if (!payload.movementType || !isValidEnum(payload.movementType, VALID_MOVEMENT_TYPES)) {
      throw new ValidationError(`movementType inválido. Valores permitidos: ${VALID_MOVEMENT_TYPES.join(", ")}`);
    }

    const quantity = Number(payload.quantity);
    if (!isFinite(quantity) || isNaN(quantity)) {
      throw new ValidationError("quantity debe ser un número finito");
    }
    // Límite razonable para evitar valores absurdo — no impone signo (respeta la semántica del dominio)
    if (Math.abs(quantity) > 1_000_000) {
      throw new ValidationError("quantity excede el límite máximo permitido (1,000,000)");
    }

    if (payload.notes !== undefined && payload.notes !== null) {
      if (!isStringWithin(payload.notes, 255)) {
        throw new ValidationError("notes no debe exceder 255 caracteres");
      }
    }

    const dto: RegisterMovementDTO = {
      itemId,
      movementType: payload.movementType as MovementType,
      quantity,
      unitCost: payload.unitCost !== undefined && payload.unitCost !== null ? Number(payload.unitCost) : undefined,
      referenceType: payload.referenceType,
      referenceId: payload.referenceId ? Number(payload.referenceId) : undefined,
      notes: payload.notes,
      performedBy: authUser.id,  // SIEMPRE del JWT
    };

    const movement = await this.registerMovementUseCase.execute(dto);

    ctx.response.status = 201;
    ctx.response.body = {
      message: "Movimiento de inventario registrado correctamente",
      data: this.serializeMovement(movement),
    };
  }

  /**
   * GET /api/v1/inventory/movements
   */
  async getMovements(ctx: Context) {
    const itemIdParam = ctx.request.url.searchParams.get("itemId");
    const limitParam = ctx.request.url.searchParams.get("limit");

    let itemId: number | undefined;
    if (itemIdParam !== null) {
      const n = Number(itemIdParam);
      if (!Number.isInteger(n) || n <= 0) {
        throw new ValidationError("itemId debe ser un entero positivo");
      }
      itemId = n;
    }

    const limit = limitParam !== null ? Number(limitParam) : 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new ValidationError("limit debe ser un entero entre 1 y 500");
    }

    const movements = await this.listMovementsUseCase.execute(itemId, limit);

    ctx.response.status = 200;
    ctx.response.body = {
      data: movements.map((m) => this.serializeMovement(m)),
      count: movements.length,
    };
  }

  private serializeItem(item: any): object {
    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      currentStock: item.currentStock,
      minStock: item.minStock,
      maxStock: item.maxStock,
      costPerUnit: item.costPerUnit,
      supplier: item.supplier,
      isActive: item.isActive,
      isLowStock: item.isLowStock,
      isOutOfStock: item.isOutOfStock,
      totalValue: item.totalValue,
    };
  }

  private serializeMovement(movement: any): object {
    return {
      id: movement.id,
      itemId: movement.itemId,
      itemName: movement.itemName,
      movementType: movement.movementType,
      quantity: movement.quantity,
      unitCost: movement.unitCost,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      notes: movement.notes,
      performedBy: movement.performedBy,
      createdAt: movement.createdAt instanceof Date ? movement.createdAt.toISOString() : movement.createdAt,
    };
  }
}

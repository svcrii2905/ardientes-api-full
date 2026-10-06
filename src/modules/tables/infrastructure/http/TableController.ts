import { Context } from "oak";
import { GetTablesUseCase } from "../../application/use-cases/GetTablesUseCase.ts";
import { GetTableByIdUseCase } from "../../application/use-cases/GetTableByIdUseCase.ts";
import { GetTableOrdersUseCase } from "../../application/use-cases/GetTableOrdersUseCase.ts";
import { CreateTableOrderUseCase } from "../../application/use-cases/CreateTableOrderUseCase.ts";
import { RequestTableAccountUseCase } from "../../application/use-cases/RequestTableAccountUseCase.ts";
import { ReleaseTableUseCase } from "../../application/use-cases/ReleaseTableUseCase.ts";
import { TransferTableUseCase } from "../../application/use-cases/TransferTableUseCase.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";
import { isStringWithin } from "../../../../common/validation.ts";

export class TableController {
  constructor(
    private readonly getTablesUseCase: GetTablesUseCase,
    private readonly getTableByIdUseCase: GetTableByIdUseCase,
    private readonly getTableOrdersUseCase: GetTableOrdersUseCase,
    private readonly createTableOrderUseCase: CreateTableOrderUseCase,
    private readonly requestTableAccountUseCase: RequestTableAccountUseCase,
    private readonly releaseTableUseCase: ReleaseTableUseCase,
    private readonly transferTableUseCase: TransferTableUseCase
  ) {}

  async getTables(ctx: Context): Promise<void> {
    const tablesSummary = await this.getTablesUseCase.execute();
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: tablesSummary.map((ts) => ({
        id: ts.table.id,
        number: ts.table.number,
        name: ts.table.name,
        status: ts.table.status,
        accountRequested: ts.table.accountRequested,
        createdAt: ts.table.createdAt.toISOString(),
        updatedAt: ts.table.updatedAt.toISOString(),
        activeOrdersCount: ts.activeOrdersCount,
        totalPendingAmount: ts.totalPendingAmount,
      })),
    };
  }

  async getTableById(ctx: Context): Promise<void> {
    const id = Number((ctx as any).params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError("ID de mesa inválido");
    }

    const table = await this.getTableByIdUseCase.execute(id);
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: {
        id: table.id,
        number: table.number,
        name: table.name,
        status: table.status,
        accountRequested: table.accountRequested,
        createdAt: table.createdAt.toISOString(),
        updatedAt: table.updatedAt.toISOString(),
      },
    };
  }

  async getTableOrders(ctx: Context): Promise<void> {
    const id = Number((ctx as any).params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError("ID de mesa inválido");
    }

    const activeOnly = ctx.request.url.searchParams.get("activeOnly") !== "false";
    const orders = await this.getTableOrdersUseCase.execute(id, activeOnly);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        tableId: o.tableId,
        status: o.status.value,
        subtotal: o.subtotal,
        disposableFee: o.disposableFee,
        total: o.total,
        createdAt: o.createdAt?.toISOString(),
        paidAt: o.paidAt?.toISOString(),
        kitchenStartedAt: o.kitchenStartedAt?.toISOString(),
        items: o.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
          toppings: i.toppings.map((t) => ({
            id: t.id,
            toppingId: t.toppingId,
            toppingName: t.toppingName,
            quantity: t.quantity,
            extraPrice: t.extraPrice,
            lineTotal: t.lineTotal,
          })),
        })),
        beverages: o.beverages.map((b) => ({
          id: b.id,
          beverageId: b.beverageId,
          beverageName: b.beverageName,
          quantity: b.quantity,
          unitPrice: b.unitPrice,
          lineTotal: b.lineTotal,
        })),
      })),
    };
  }

  async createTableOrder(ctx: Context): Promise<void> {
    const id = Number((ctx as any).params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError("ID de mesa inválido");
    }

    if (!ctx.request.hasBody) {
      throw new ValidationError("El cuerpo de la petición no puede estar vacío");
    }

    const body = await ctx.request.body({ type: "json", limit: 1_048_576 }).value;
    const authUser = (ctx.state as any).user;

    // Validación de campos opcionales del body
    if (body.notes !== undefined && body.notes !== null && !isStringWithin(body.notes, 255)) {
      throw new ValidationError("notes no debe exceder 255 caracteres");
    }
    if (body.deliveryAddress !== undefined && body.deliveryAddress !== null && !isStringWithin(body.deliveryAddress, 255)) {
      throw new ValidationError("deliveryAddress no debe exceder 255 caracteres");
    }

    const order = await this.createTableOrderUseCase.execute({
      ...body,
      userId: authUser.id,  // SIEMPRE del JWT — nunca del body
      tableId: id,
      sendToKitchen: body.sendToKitchen === true,
      discountAmount: body.discountAmount !== undefined ? Math.max(0, Number(body.discountAmount) || 0) : undefined,
    });

    ctx.response.status = 201;
    ctx.response.body = {
      success: true,
      message: `Pedido creado para la mesa #${id}`,
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        tableId: order.tableId,
        status: order.status?.value ?? order.status ?? null,
        total: order.total,
        createdAt: order.createdAt?.toISOString(),
      },
    };
  }

  async requestBill(ctx: Context): Promise<void> {
    const id = Number((ctx as any).params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError("ID de mesa inválido");
    }

    const table = await this.requestTableAccountUseCase.execute(id);
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: `Cuenta solicitada para ${table.name}`,
      data: {
        id: table.id,
        name: table.name,
        status: table.status,
        accountRequested: table.accountRequested,
      },
    };
  }

  async releaseTable(ctx: Context): Promise<void> {
    const id = Number((ctx as any).params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError("ID de mesa inválido");
    }

    const table = await this.releaseTableUseCase.execute(id);
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: `${table.name} liberada exitosamente`,
      data: {
        id: table.id,
        name: table.name,
        status: table.status,
        accountRequested: table.accountRequested,
      },
    };
  }

  async transferTable(ctx: Context): Promise<void> {
    const sourceTableId = Number((ctx as any).params.id);
    if (!Number.isInteger(sourceTableId) || sourceTableId <= 0) {
      throw new ValidationError("ID de mesa origen inválido");
    }

    if (!ctx.request.hasBody) {
      throw new ValidationError("Debe especificar la mesa destino (targetTableId)");
    }

    const body = await ctx.request.body({ type: "json", limit: 1_048_576 }).value;
    const targetTableId = Number(body.targetTableId);
    if (!Number.isInteger(targetTableId) || targetTableId <= 0) {
      throw new ValidationError("targetTableId debe ser un ID de mesa válido");
    }

    const result = await this.transferTableUseCase.execute(sourceTableId, targetTableId);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: `Pedidos trasladados exitosamente de ${result.sourceTable.name} a ${result.targetTable.name}`,
      data: {
        sourceTable: {
          id: result.sourceTable.id,
          name: result.sourceTable.name,
          status: result.sourceTable.status,
        },
        targetTable: {
          id: result.targetTable.id,
          name: result.targetTable.name,
          status: result.targetTable.status,
        },
      },
    };
  }
}

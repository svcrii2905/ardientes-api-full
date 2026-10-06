import { BusinessDayClosure } from "../../domain/BusinessDayClosure.ts";
import { BusinessDayClosureRepository } from "../../domain/BusinessDayClosureRepository.ts";
import { ValidationError } from "../../../../shared/domain/error.ts";
import { transactionManager } from "../../../../shared/infrastructure/database.ts";
import { TableEventPublisher } from "../../../tables/domain/TableEventPublisher.ts";
import { TableRepository } from "../../../tables/domain/TableRepository.ts";

export interface CloseBusinessDayDTO {
  closedByUserId: number; // Identidad del JWT exclusivamente
  businessDate?: string;  // Opcional, por defecto fecha local de Colombia
  notes?: string;
}

export class CloseBusinessDayUseCase {
  constructor(
    private readonly closureRepository: BusinessDayClosureRepository,
    private readonly tableRepository?: TableRepository,
    private readonly tableEventPublisher?: TableEventPublisher
  ) {}

  async execute(dto: CloseBusinessDayDTO): Promise<BusinessDayClosure> {
    if (!dto.closedByUserId || dto.closedByUserId <= 0) {
      throw new ValidationError("closedByUserId es obligatorio y debe provenir de la sesión autenticada (JWT)");
    }

    const targetDate = dto.businessDate || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

    // 1. Obtener resumen de la jornada
    const summary = await this.closureRepository.getDaySummary(targetDate);

    // 2. Validación 1: Cierre duplicado
    if (summary.isClosed) {
      throw new ValidationError("La jornada del día ya fue finalizada.");
    }

    // 3. Validación 2: Cajas abiertas (Respetando Ownership de Caja y mostrando nombre real)
    if (summary.openCashSessionsCount > 0) {
      const blockers = summary.openCashSessionsDetails
        .map((d) => `Caja #${d.registerId} abierta por ${d.openedByUserName}`)
        .join(", ");
      throw new ValidationError(
        `No se puede finalizar la jornada porque existen cajas abiertas: ${blockers}. Cada titular debe realizar el arqueo y cierre de caja primero.`
      );
    }

    // 4. Validación 3: Pedidos pendientes (en mesas sin pagar o en cocina/entrega)
    if (summary.pendingOrdersCount > 0) {
      const orderList = summary.pendingOrdersDetails
        .slice(0, 5)
        .map((o) => `${o.displayOrderNumber} (${o.status}${o.tableId ? ` - Mesa ${o.tableId}` : ""})`)
        .join(", ");
      const extraCount = summary.pendingOrdersCount > 5 ? ` y ${summary.pendingOrdersCount - 5} más` : "";
      throw new ValidationError(
        `No se puede finalizar la jornada porque existen ${summary.pendingOrdersCount} pedido(s) pendiente(s) de cobro o entrega: ${orderList}${extraCount}. Atiende o cobra los pedidos antes de cerrar.`
      );
    }

    // 5. Ejecución atómica y transaccional
    const now = new Date();
    const closureEntity = new BusinessDayClosure(
      null,
      targetDate,
      summary.openedAt || now,
      now,
      dto.closedByUserId,
      summary.totalOrdersCount,
      summary.totalSalesAmount,
      summary.totalCashAmount,
      summary.totalDigitalAmount,
      summary.totalCardAmount,
      dto.notes || null,
      now
    );

    const savedClosure = await transactionManager.runInTransaction(async (exec) => {
      // 5.1 Guardar el registro de cierre del día
      const saved = await this.closureRepository.save(closureEntity, exec);

      // 5.2 Resetear el estado operativo de las mesas a AVAILABLE (sin alterar RESERVED si existiera)
      await this.closureRepository.resetTablesToAvailable(exec);

      return saved;
    });

    // 6. Notificar por WebSocket que las mesas han sido liberadas
    if (this.tableRepository && this.tableEventPublisher) {
      try {
        const tables = await this.tableRepository.findAll();
        for (const t of tables) {
          this.tableEventPublisher.notifyTableStatusChanged(t);
        }
      } catch (_err) {
        // Ignorar error secundario de difusión WS
      }
    }

    return savedClosure;
  }
}

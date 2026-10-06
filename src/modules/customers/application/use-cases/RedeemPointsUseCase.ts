import { CustomerRepository } from "../../domain/CustomerRepository.ts";
import { LoyaltyTransaction } from "../../domain/LoyaltyTransaction.ts";
import { NotFoundError, ValidationError } from "../../../../shared/domain/error.ts";
import { TransactionManager, QueryExecutor } from "../../../../shared/infrastructure/database.ts";

export interface RedeemPointsDTO {
  customerId: number;
  rewardCount: number; // Cantidad de recompensas (hamburguesas gratis) a redimir
  performedBy: number; // ID del usuario/cajero que autoriza la redención
  orderId?: number | null; // Pedido en el cual se redime, si aplica
  notes?: string | null;
}

export interface RedeemPointsResult {
  customerId: number;
  redeemedRewards: number;
  pointsDeducted: number;
  remainingPoints: number;
  transactionId: number;
}

export class RedeemPointsUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly transactionManager: TransactionManager
  ) {}

  async execute(dto: RedeemPointsDTO): Promise<RedeemPointsResult> {
    if (!dto.customerId || dto.customerId <= 0) {
      throw new ValidationError("Se requiere un ID de cliente válido");
    }
    if (!dto.rewardCount || dto.rewardCount <= 0) {
      throw new ValidationError("La cantidad de recompensas debe ser al menos 1");
    }
    if (!dto.performedBy || dto.performedBy <= 0) {
      throw new ValidationError("Se requiere el usuario responsable de la redención");
    }

    return await this.transactionManager.runInTransaction(async (exec: QueryExecutor) => {
      const customer = await this.customerRepository.findById(dto.customerId, exec);
      if (!customer) {
        throw new NotFoundError(`Cliente con ID ${dto.customerId} no encontrado`);
      }

      if (!customer.isActive) {
        throw new ValidationError("El cliente se encuentra inactivo");
      }

      // Descontar puntos en la entidad de dominio (valida saldo suficiente)
      const pointsDeducted = customer.redeemRewards(dto.rewardCount);

      // Actualizar cliente
      await this.customerRepository.update(customer, exec);

      // Registrar movimiento auditable en loyalty_transactions
      const notes = dto.notes?.trim() || `Canje de ${dto.rewardCount} hamburguesa(s) gratis (-${pointsDeducted} puntos)`;
      const tx = new LoyaltyTransaction(
        null,
        customer.id!,
        dto.orderId ?? null,
        -pointsDeducted,
        "CANJE",
        notes,
        dto.performedBy,
        new Date()
      );

      const savedTx = await this.customerRepository.addLoyaltyTransaction(tx, exec);

      return {
        customerId: customer.id!,
        redeemedRewards: dto.rewardCount,
        pointsDeducted,
        remainingPoints: customer.loyaltyPoints,
        transactionId: savedTx.id!,
      };
    });
  }
}

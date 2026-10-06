import { InventoryItemRepository } from "../../domain/InventoryItemRepository.ts";
import { InventoryMovementRepository } from "../../domain/InventoryMovementRepository.ts";
import { InventoryMovement, MovementType, ReferenceType } from "../../domain/InventoryMovement.ts";
import { TransactionManager } from "../../../../shared/infrastructure/database.ts";

export interface RegisterMovementDTO {
  itemId: number;
  movementType: MovementType;
  quantity: number;
  unitCost?: number | null;
  referenceType?: ReferenceType;
  referenceId?: number | null;
  notes?: string | null;
  performedBy?: number;
}

export class RegisterMovementUseCase {
  constructor(
    private readonly itemRepository: InventoryItemRepository,
    private readonly movementRepository: InventoryMovementRepository,
    private readonly transactionManager: TransactionManager
  ) {}

  async execute(dto: RegisterMovementDTO): Promise<InventoryMovement> {
    if (!dto.itemId) throw new Error("El ID del insumo es obligatorio");
    if (!dto.movementType) throw new Error("El tipo de movimiento es obligatorio");
    if (typeof dto.quantity !== "number" || isNaN(dto.quantity) || dto.quantity <= 0) {
      throw new Error("La cantidad debe ser un número positivo mayor a 0");
    }

    return await this.transactionManager.runInTransaction(async (exec) => {
      const item = await this.itemRepository.findById(dto.itemId, exec);
      if (!item) {
        throw new Error(`No se encontró el insumo con ID ${dto.itemId}`);
      }

      let newStock = item.currentStock;
      if (dto.movementType === 'ENTRADA') {
        newStock += dto.quantity;
      } else if (dto.movementType === 'SALIDA' || dto.movementType === 'MERMA') {
        newStock -= dto.quantity;
      } else if (dto.movementType === 'AJUSTE') {
        // En ajuste, si se indica cantidad, puede ser la nueva cantidad total
        // o si es menor/mayor que la actual. Si el usuario ingresa la nueva cantidad directa en ajuste:
        // pero si ingresó la diferencia o valor absoluto, tratémoslo como la nueva cantidad objetivo si es ajuste
        // O si prefiere incremento/decremento. Ajuste en el formulario usualmente ingresa la nueva cantidad total o ajuste directo.
        // Si nueva cantidad < 0 rechazar.
        newStock = dto.quantity;
      }

      if (newStock < 0) {
        throw new Error(`El stock resultante (${newStock} ${item.unit}) no puede ser negativo`);
      }

      // Actualizar stock en DB
      await this.itemRepository.updateStock(dto.itemId, newStock, exec);

      // Registrar movimiento
      const movement = await this.movementRepository.save(
        {
          itemId: dto.itemId,
          movementType: dto.movementType,
          quantity: dto.quantity,
          unitCost: dto.unitCost ?? (dto.movementType === 'ENTRADA' ? item.costPerUnit : null),
          referenceType: dto.referenceType ?? 'MANUAL',
          referenceId: dto.referenceId ?? null,
          notes: dto.notes ?? null,
          performedBy: dto.performedBy ?? 1, // Default user 1 (Admin)
        },
        exec
      );

      return movement;
    });
  }
}

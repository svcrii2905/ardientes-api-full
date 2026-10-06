import { InventoryMovement } from "../../domain/InventoryMovement.ts";
import { InventoryMovementRepository } from "../../domain/InventoryMovementRepository.ts";

export class ListMovementsUseCase {
  constructor(private readonly movementRepository: InventoryMovementRepository) {}

  async execute(itemId?: number, limit: number = 50): Promise<InventoryMovement[]> {
    if (itemId) {
      return await this.movementRepository.findByItemId(itemId, limit);
    }
    return await this.movementRepository.findAll(limit);
  }
}

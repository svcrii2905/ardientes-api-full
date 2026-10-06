import { InventoryItem } from "../../domain/InventoryItem.ts";
import { InventoryItemRepository } from "../../domain/InventoryItemRepository.ts";

export class GetLowStockItemsUseCase {
  constructor(private readonly itemRepository: InventoryItemRepository) {}

  async execute(): Promise<InventoryItem[]> {
    return await this.itemRepository.findLowStock();
  }
}

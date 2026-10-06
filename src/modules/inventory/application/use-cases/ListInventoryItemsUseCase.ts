import { InventoryItem } from "../../domain/InventoryItem.ts";
import { InventoryItemRepository } from "../../domain/InventoryItemRepository.ts";

export class ListInventoryItemsUseCase {
  constructor(private readonly itemRepository: InventoryItemRepository) {}

  async execute(activeOnly: boolean = true): Promise<InventoryItem[]> {
    return await this.itemRepository.findAll(activeOnly);
  }
}

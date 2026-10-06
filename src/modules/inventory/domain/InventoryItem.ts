export class InventoryItem {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly unit: 'GRAMO' | 'UNIDAD' | 'LITRO' | 'MILILITRO' | 'PORCION',
    public readonly currentStock: number,
    public readonly minStock: number,
    public readonly maxStock: number | null,
    public readonly costPerUnit: number,
    public readonly supplier: string | null,
    public readonly isActive: boolean
  ) {}

  public get isLowStock(): boolean {
    return this.currentStock <= this.minStock;
  }

  public get isOutOfStock(): boolean {
    return this.currentStock <= 0;
  }

  public get totalValue(): number {
    return this.currentStock * this.costPerUnit;
  }
}

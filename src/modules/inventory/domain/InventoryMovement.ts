export type MovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'MERMA';
export type ReferenceType = 'PEDIDO' | 'COMPRA' | 'MANUAL' | 'AJUSTE' | 'RECETA';

export class InventoryMovement {
  constructor(
    public readonly id: number,
    public readonly itemId: number,
    public readonly movementType: MovementType,
    public readonly quantity: number,
    public readonly unitCost: number | null,
    public readonly referenceType: ReferenceType,
    public readonly referenceId: number | null,
    public readonly notes: string | null,
    public readonly performedBy: number,
    public readonly createdAt: Date,
    public readonly itemName?: string
  ) {}
}

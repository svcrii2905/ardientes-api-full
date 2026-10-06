/**
 * inventory.service.js — Servicio de inventario
 * Endpoints: /api/v1/inventory
 */
import { api } from './api.service.js';

export const inventoryService = {
  /**
   * Obtiene la lista de insumos de inventario.
   * @param {object} filter - { activeOnly?: boolean }
   */
  async getItems(filter = {}) {
    const params = new URLSearchParams();
    if (filter.activeOnly !== undefined) params.set('activeOnly', filter.activeOnly);
    const qs = params.toString() ? `?${params}` : '';
    const res = await api.get(`/api/v1/inventory/items${qs}`);
    return res.data ?? [];
  },

  /**
   * Obtiene los insumos con stock bajo o agotado.
   */
  async getLowStock() {
    const res = await api.get('/api/v1/inventory/items/low-stock');
    return res.data ?? [];
  },

  /**
   * Registra un movimiento de inventario (Entrada, Salida, Ajuste, Merma).
   * @param {object} dto - { itemId, movementType, quantity, unitCost?, referenceType?, referenceId?, notes?, performedBy? }
   */
  async registerMovement(dto) {
    const res = await api.post('/api/v1/inventory/movements', dto);
    return res;
  },

  /**
   * Obtiene el historial de movimientos de inventario.
   * @param {object} filter - { itemId?, limit? }
   */
  async getMovements(filter = {}) {
    const params = new URLSearchParams();
    if (filter.itemId) params.set('itemId', filter.itemId);
    if (filter.limit)  params.set('limit', filter.limit);
    const qs = params.toString() ? `?${params}` : '';
    const res = await api.get(`/api/v1/inventory/movements${qs}`);
    return res.data ?? [];
  },
};

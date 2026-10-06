/**
 * orders.service.js — Servicio de pedidos
 * Endpoints: /api/v1/orders
 */
import { api } from './api.service.js';

export const ordersService = {
  /**
   * Lista pedidos con filtros opcionales.
   * @param {object} filters - { status?, orderType?, limit?, offset? }
   */
  async listOrders(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status)    params.set('status', filters.status);
    if (filters.orderType) params.set('orderType', filters.orderType);
    if (filters.limit)     params.set('limit', filters.limit);
    if (filters.offset)    params.set('offset', filters.offset);
    const qs = params.toString() ? `?${params}` : '';
    const res = await api.get(`/api/v1/orders${qs}`);
    return res;
  },

  /**
   * Obtiene el detalle completo de un pedido por ID.
   */
  async getOrderById(id) {
    const res = await api.get(`/api/v1/orders/${id}`);
    return res.data;
  },

  /**
   * Crea un nuevo pedido.
   * @param {object} dto - CreateOrderDTO
   *   { orderType, tableId?, customerId?, items[], beverages[], combos[], notes?, taxPercentage? }
   */
  async createOrder(dto) {
    const res = await api.post('/api/v1/orders', dto);
    return res.data;
  },

  /**
   * Cambia el estado de un pedido.
   * @param {number} id
   * @param {string} newStatus
   * @param {number} changedBy - ID de quien realiza el cambio (obsoleto, el backend usa JWT)
   * @param {string} notes
   */
  async changeStatus(id, newStatus, changedBy = 1, notes = '') {
    const res = await api.patch(`/api/v1/orders/${id}/status`, {
      newStatus,
      changedBy,
      notes,
    });
    return res.data;
  },

  /**
   * Obtiene pedidos para la pantalla de cocina (KDS).
   * @param {boolean} activeOnly - true: solo CONFIRMADO y EN_PREPARACION, false: incluye LISTO
   */
  async getKitchenOrders(activeOnly = false) {
    const res = await api.get(`/api/v1/orders/kitchen?activeOnly=${activeOnly}`);
    return res;
  },

  /**
   * Cancela un pedido.
   */
  async cancelOrder(id, cancelledBy = 1, reason = '') {
    const res = await api.patch(`/api/v1/orders/${id}/cancel`, {
      cancelledBy,
      reason,
    });
    return res.data;
  },

  /**
   * Despacha un pedido a un domiciliario.
   * @param {number} id
   * @param {number} deliveryUserId
   */
  async dispatchDelivery(id, deliveryUserId, deliveryCompany) {
    const payload = {};
    if (deliveryUserId) payload.deliveryUserId = Number(deliveryUserId);
    if (deliveryCompany) payload.deliveryCompany = deliveryCompany;

    const res = await api.patch(`/api/v1/orders/${id}/dispatch`, payload);
    return res.data;
  },
};

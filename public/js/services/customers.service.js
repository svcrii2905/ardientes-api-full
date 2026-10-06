/**
 * customers.service.js — Servicio HTTP para Clientes y Fidelización
 */
import { api } from './api.service.js';

export const customersService = {
  /**
   * Busca clientes por nombre o teléfono
   */
  async search(query = '', limit = 20) {
    const q = encodeURIComponent(query);
    const res = await api.get(`/api/v1/customers?q=${q}&limit=${limit}`);
    return res.data;
  },

  /**
   * Busca cliente directamente por teléfono
   */
  async getByPhone(phone) {
    const p = encodeURIComponent(phone.trim());
    const res = await api.get(`/api/v1/customers/by-phone/${p}`);
    return res.data;
  },

  /**
   * Obtiene el perfil de un cliente por ID
   */
  async getById(id) {
    const res = await api.get(`/api/v1/customers/${id}`);
    return res.data;
  },

  /**
   * Registra un nuevo cliente
   */
  async create(customerData) {
    const res = await api.post('/api/v1/customers', customerData);
    return res.data;
  },

  /**
   * Obtiene el estado de fidelización de un cliente (puntos, premios disponibles, historial)
   */
  async getLoyalty(id) {
    const res = await api.get(`/api/v1/customers/${id}/loyalty`);
    return res.data;
  },

  /**
   * Redime recompensas de fidelización
   */
  async redeem(id, rewardCount = 1, performedBy = 1, notes = '') {
    const res = await api.post(`/api/v1/customers/${id}/redeem`, {
      rewardCount,
      performedBy,
      notes,
    });
    return res;
  },

  /**
   * Genera un código de activación temporal para vincular la cuenta web del cliente
   */
  async generateActivationCode(customerId) {
    const res = await api.post(`/api/v1/customers/${customerId}/activation-code`, {});
    return res;
  },
};

/**
 * cash.service.js — Servicio de caja registradora
 * Endpoints: /api/v1/cash-registers
 */
import { api } from './api.service.js';

export const cashService = {
  /**
   * Abre un nuevo turno de caja.
   * @param {object} dto - { registerId, openingBalance, notes? }
   */
  async openSession(dto) {
    const res = await api.post('/api/v1/cash-registers/sessions/open', dto);
    return res.data;
  },

  /**
   * Cierra el turno de caja con arqueo.
   * @param {number} sessionId
   * @param {object} dto - { closingBalanceReal, discrepancyNotes? }
   */
  async closeSession(sessionId, dto) {
    const res = await api.post(`/api/v1/cash-registers/sessions/${sessionId}/close`, dto);
    return res.data;
  },

  /**
   * Obtiene la sesión activa de caja.
   * @param {object} filter - { registerId? }
   */
  async getActiveSession(filter = {}) {
    const params = new URLSearchParams();
    if (filter.registerId) params.set('registerId', filter.registerId);
    const qs = params.toString() ? `?${params}` : '';
    try {
      const res = await api.get(`/api/v1/cash-registers/sessions/active${qs}`);
      return res.data ?? null;
    } catch {
      return null; // 404 → no hay sesión activa
    }
  },

  /**
   * Lista sesiones de caja.
   */
  async listSessions(filter = {}) {
    const params = new URLSearchParams();
    if (filter.registerId) params.set('registerId', filter.registerId);
    if (filter.status)     params.set('status', filter.status);
    if (filter.limit)      params.set('limit', filter.limit);
    const qs = params.toString() ? `?${params}` : '';
    const res = await api.get(`/api/v1/cash-registers/sessions${qs}`);
    return res.data ?? [];
  },

  /**
   * Registra un movimiento de efectivo (depósito o retiro).
   * @param {number} sessionId
   * @param {object} dto - { transactionType: 'DEPOSIT'|'WITHDRAWAL', amount, performedBy, notes? }
   */
  async createTransaction(sessionId, dto) {
    const res = await api.post(`/api/v1/cash-registers/sessions/${sessionId}/transactions`, dto);
    return res.data;
  },

  /**
   * Lista todas las transacciones de una sesión de caja.
   * @param {number} sessionId
   */
  async listTransactions(sessionId) {
    try {
      const res = await api.get(`/api/v1/cash-registers/sessions/${sessionId}/transactions`);
      return res.data ?? [];
    } catch {
      return [];
    }
  },
};

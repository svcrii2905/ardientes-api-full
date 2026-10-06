/**
 * payments.service.js — Servicio de pagos
 * Endpoints: /api/v1/payments
 */
import { api } from './api.service.js';

export const paymentsService = {
  /**
   * Obtiene métodos de pago activos.
   */
  async getPaymentMethods() {
    const res = await api.get('/api/v1/payments/methods');
    return res.data ?? [];
  },

  /**
   * Registra un pago para un pedido.
   * @param {object} dto
   *   { orderId, paymentMethodId, sessionId?, amount, changeAmount?, transactionReference?, performedBy, notes? }
   */
  async processPayment(dto) {
    const res = await api.post('/api/v1/payments', dto);
    return res.data;
  },

  /**
   * Obtiene el resumen de pagos de un pedido (saldo pendiente, etc.).
   */
  async getOrderPayments(orderId) {
    const res = await api.get(`/api/v1/payments/order/${orderId}`);
    return res.data;
  },

  /**
   * Revierte un pago procesado.
   */
  async revertPayment(paymentId, performedBy = 1, notes = '') {
    const res = await api.patch(`/api/v1/payments/${paymentId}/revert`, {
      performedBy,
      notes,
    });
    return res.data;
  },
};

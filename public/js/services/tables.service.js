import { api } from "./api.service.js";

/**
 * Servicio API para la gestión de Mesas (Bloque 4)
 */
export const tablesService = {
  /**
   * Obtiene las 7 mesas físicas con su estado y resumen de pedidos
   */
  async getTables() {
    return await api.get("/api/v1/tables");
  },

  /**
   * Obtiene los detalles de una mesa específica
   * @param {number} id
   */
  async getTable(id) {
    return await api.get(`/api/v1/tables/${id}`);
  },

  /**
   * Obtiene los pedidos activos de una mesa
   * @param {number} id
   * @param {boolean} activeOnly
   */
  async getTableOrders(id, activeOnly = true) {
    return await api.get(`/api/v1/tables/${id}/orders?activeOnly=${activeOnly}`);
  },

  /**
   * Crea un nuevo pedido para una mesa
   * @param {number} tableId
   * @param {object} orderData
   */
  async createTableOrder(tableId, orderData) {
    return await api.post(`/api/v1/tables/${tableId}/orders`, orderData);
  },

  /**
   * Solicita la cuenta para una mesa ocupada
   * @param {number} tableId
   */
  async requestBill(tableId) {
    return await api.post(`/api/v1/tables/${tableId}/request-bill`, {});
  },

  /**
   * Libera una mesa (debe tener 0 pedidos pendientes)
   * @param {number} tableId
   */
  async releaseTable(tableId) {
    return await api.post(`/api/v1/tables/${tableId}/release`, {});
  },

  /**
   * Traslada los pedidos de una mesa a otra mesa libre
   * @param {number} sourceTableId
   * @param {number} targetTableId
   */
  async transferTable(sourceTableId, targetTableId) {
    return await api.post(`/api/v1/tables/${sourceTableId}/transfer`, { targetTableId });
  },
};

/**
 * users.service.js — Servicio de usuarios
 * Endpoints: /api/v1/users
 */
import { api } from './api.service.js';

export const usersService = {
  /**
   * Obtiene la lista de usuarios domiciliarios activos.
   * Retorna un arreglo de domiciliarios: { id, username, fullName }
   */
  async getDrivers() {
    const res = await api.get('/api/v1/users/drivers');
    return res.data;
  }
};

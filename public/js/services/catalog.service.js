/**
 * catalog.service.js — Servicio de catálogo de productos y categorías
 * Endpoints: GET /api/v1/catalog/categories y /api/v1/catalog/products
 */
import { api } from './api.service.js';

export const catalogService = {
  /**
   * Obtiene categorías activas del menú.
   * @param {boolean} all - true para incluir categorías inactivas
   */
  async getCategories(all = false) {
    const qs = all ? '?all=true' : '';
    const res = await api.get(`/api/v1/catalog/categories${qs}`);
    return res.data ?? [];
  },

  /**
   * Obtiene productos del catálogo.
   * @param {object} opts - { categoryId?, all? }
   */
  async getProducts({ categoryId, all = false } = {}) {
    const params = new URLSearchParams();
    if (categoryId) params.set('categoryId', categoryId);
    if (all) params.set('all', 'true');
    const qs = params.toString() ? `?${params}` : '';
    const res = await api.get(`/api/v1/catalog/products${qs}`);
    return res.data ?? [];
  },

  /**
   * Crea una nueva categoría.
   */
  async createCategory(dto) {
    return await api.post('/api/v1/catalog/categories', dto);
  },

  /**
   * Crea un nuevo producto.
   */
  async createProduct(dto) {
    return await api.post('/api/v1/catalog/products', dto);
  },

  /**
   * Obtiene bebidas activas del catálogo para el selector de promos.
   */
  async getBeverages() {
    const res = await api.get('/api/v1/catalog/beverages');
    return res.data ?? [];
  },

  /**
   * Obtiene los toppings permitidos para un producto específico.
   */
  async getProductToppings(productId) {
    const res = await api.get(`/api/v1/catalog/products/${productId}/toppings`);
    return res.data ?? [];
  },

  /**
   * Obtiene las reglas de toppings por tipo de menú.
   */
  async getMenuRules() {
    const res = await api.get('/api/v1/catalog/menu-rules');
    return res.data ?? [];
  },
};

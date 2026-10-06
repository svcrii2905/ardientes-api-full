/**
 * customerAuth.service.js — Servicio de autenticación exclusivo para Clientes de Ardientes POS
 * Maneja el ciclo de vida del JWT de cliente (ardientes_customer_token),
 * registro, activación, login, obtención de perfil y cierre de sesión.
 * Totalmente aislado del flujo y tokens de colaboradores.
 */
import { CONFIG } from '../config.js';

const CUSTOMER_TOKEN_KEY = 'ardientes_customer_token';
const CUSTOMER_USER_KEY = 'ardientes_customer_user';

class CustomerAuthService {
  #base;

  constructor(base = '') {
    this.#base = base;
  }

  async #request(method, path, body = null) {
    const url = `${this.#base}${path}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    };

    const token = this.getToken();
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body !== null) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMsg = `Error ${response.status}`;
      let errorPayload = null;
      try {
        errorPayload = await response.json();
        errorMsg = errorPayload?.error?.message || errorPayload?.message || errorPayload?.error || errorMsg;
        if (typeof errorMsg !== 'string') errorMsg = `Error ${response.status}`;
      } catch {
        /* No JSON */
      }

      // Si el token de cliente es inválido o expiró (401), se limpia la sesión local del cliente
      // NUNCA disparamos auth:unauthorized de colaboradores ni tocamos ardientes_token
      if (response.status === 401 && !path.includes('/login') && !path.includes('/activate')) {
        this.clearSession();
      }

      const error = new Error(errorMsg);
      error.status = response.status;
      error.payload = errorPayload;
      throw error;
    }

    if (response.status === 204) return null;
    return response.json();
  }

  /**
   * Registra un cliente totalmente nuevo
   */
  async register(data) {
    const res = await this.#request('POST', '/api/v1/client/register', data);
    if (res?.data?.accessToken && res?.data?.customer) {
      this.setToken(res.data.accessToken);
      this.setCurrentCustomer(res.data.customer);
      return res.data.customer;
    }
    return res;
  }

  /**
   * Inicia sesión con teléfono o correo + contraseña
   */
  async login(identifier, password) {
    const res = await this.#request('POST', '/api/v1/client/login', { identifier, password });
    if (res?.data?.accessToken && res?.data?.customer) {
      this.setToken(res.data.accessToken);
      this.setCurrentCustomer(res.data.customer);
      return res.data.customer;
    }
    throw new Error('No se recibió token de acceso en la respuesta.');
  }

  /**
   * Activa una cuenta existente de Caja mediante código temporal y contraseña nueva
   */
  async activate({ phone, activationCode, password, email }) {
    const res = await this.#request('POST', '/api/v1/client/activate', {
      phone,
      activationCode,
      password,
      email: email || undefined,
    });
    if (res?.data?.accessToken && res?.data?.customer) {
      this.setToken(res.data.accessToken);
      this.setCurrentCustomer(res.data.customer);
      return res.data.customer;
    }
    throw new Error('No se completó la activación correctamente.');
  }

  /**
   * Obtiene el perfil actual del cliente desde el backend mediante /api/v1/client/me
   */
  async fetchMe() {
    if (!this.getToken()) throw new Error('No hay sesión de cliente activa');
    const res = await this.#request('GET', '/api/v1/client/me');
    if (res?.data?.customer) {
      this.setCurrentCustomer(res.data.customer);
      return res.data.customer;
    }
    throw new Error('No se pudo recuperar los datos del cliente');
  }

  /**
   * Cierra la sesión de cliente
   */
  logout() {
    this.clearSession();
  }

  getToken() {
    return localStorage.getItem(CUSTOMER_TOKEN_KEY);
  }

  setToken(token) {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  }

  getCurrentCustomer() {
    try {
      const data = localStorage.getItem(CUSTOMER_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  setCurrentCustomer(customer) {
    localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(customer));
  }

  clearSession() {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_USER_KEY);
  }

  isAuthenticated() {
    return Boolean(this.getToken() && this.getCurrentCustomer());
  }
}

export const customerAuthService = new CustomerAuthService(CONFIG.API_BASE);

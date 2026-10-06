/**
 * api.service.js — Cliente HTTP centralizado para Ardientes POS
 * Toda comunicación con el backend pasa por aquí.
 */
import { CONFIG } from '../config.js';

class ApiService {
  #base;

  constructor(base = '') {
    this.#base = base;
  }

  async #request(method, path, body = null) {
    const url = `${this.#base}${path}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    };

    const token = localStorage.getItem('ardientes_token');
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body !== null) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMsg = `Error ${response.status}`;
      try {
        const err = await response.json();
        // Backend returns: { error: { code, message } }  OR  { message } OR { error }
        errorMsg = err?.error?.message || err?.message || err?.error || errorMsg;
        // If err.error is an object (not string), fall back
        if (typeof errorMsg !== 'string') errorMsg = `Error ${response.status}`;
      } catch { /* no JSON */ }

      if (response.status === 401 && !path.includes('/auth/login')) {
        const isPasswordValidationError = errorMsg.toLowerCase().includes('contraseña actual');
        if (!isPasswordValidationError) {
          localStorage.removeItem('ardientes_token');
          globalThis.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
      }

      const error = new Error(errorMsg);
      error.status = response.status;
      throw error;
    }

    // 204 No Content
    if (response.status === 204) return null;

    return response.json();
  }

  get(path)            { return this.#request('GET', path); }
  post(path, body)     { return this.#request('POST', path, body); }
  patch(path, body)    { return this.#request('PATCH', path, body); }
  put(path, body)      { return this.#request('PUT', path, body); }
  delete(path)         { return this.#request('DELETE', path); }

  /** Verifica que el backend esté disponible */
  async checkHealth() {
    try {
      const data = await this.get('/health');
      return data?.status === 'ok';
    } catch {
      return false;
    }
  }
}

export const api = new ApiService(CONFIG.API_BASE);

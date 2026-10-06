/**
 * auth.service.js — Servicio de autenticación para Ardientes POS
 * Maneja el ciclo de vida del JWT, login, logout y validación de permisos en el cliente.
 */
import { store } from '../store/state.js';
import { api } from './api.service.js';

const TOKEN_KEY = 'ardientes_token';

class AuthService {
  /**
   * Intenta autenticar al usuario y guarda el token.
   * @param {string} identifier - Username o email
   * @param {string} password - Contraseña
   */
  async login(identifier, password) {
    // Usamos api.post directo. Si el backend responde ok, guardamos el token.
    const response = await api.post('/api/v1/auth/login', { identifier, password });
    
    if (response && response.data && response.data.accessToken) {
      this.setToken(response.data.accessToken);
      // Actualizamos el estado global
      store.set({ currentUser: response.data.user });
      return response.data.user;
    }
    throw new Error('No se recibió token del servidor.');
  }

  /**
   * Obtiene el perfil actual validando el token contra el servidor.
   */
  async fetchMe() {
    if (!this.getToken()) throw new Error('No token found');
    const response = await api.get('/api/v1/auth/me');
    if (response && response.data && response.data.user) {
      store.set({ currentUser: response.data.user });
      return response.data.user;
    }
    throw new Error('No se pudo recuperar el perfil del usuario');
  }

  /**
   * Cierra la sesión local (y opcionalmente en servidor).
   */
  async logout() {
    try {
      if (this.getToken()) {
        await api.post('/api/v1/auth/logout', {});
      }
    } catch (e) {
      // Ignoramos si el backend rechaza o no existe el endpoint, 
      // la responsabilidad principal es limpiar el frontend.
      console.warn("Logout endpoint error:", e);
    } finally {
      this.clearSession();
    }
  }

  /**
   * Obtiene el JWT almacenado.
   */
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Almacena el JWT (y sobreescribe el actual).
   */
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  /**
   * Elimina el JWT y resetea el usuario activo.
   */
  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    store.set({ currentUser: null, cashSession: null });
  }

  /**
   * Obtiene el usuario actual desde el store.
   */
  getCurrentUser() {
    return store.get('currentUser');
  }

  /**
   * Comprueba si hay una sesión aparentemente activa.
   */
  isAuthenticated() {
    return !!this.getToken() && !!this.getCurrentUser();
  }

  /**
   * Verifica si el usuario activo tiene un rol específico.
   * @param {string} roleName
   */
  hasRole(roleName) {
    const user = this.getCurrentUser();
    if (!user || !user.roles) return false;
    // ADMIN siempre tiene acceso
    if (user.roles.includes('ADMIN')) return true;
    return user.roles.includes(roleName);
  }

  /**
   * Verifica si el usuario activo tiene un permiso específico.
   * @param {string} permission
   */
  hasPermission(permission) {
    const user = this.getCurrentUser();
    if (!user || !user.permissions) return false;
    // ADMIN siempre tiene acceso
    if (user.roles && user.roles.includes('ADMIN')) return true;
    return user.permissions.includes(permission);
  }

  /**
   * Verifica si el usuario activo tiene AL MENOS UNO de los permisos provistos.
   * @param {string[]} permissions
   */
  hasAnyPermission(permissions) {
    return permissions.some(p => this.hasPermission(p));
  }

  /**
   * Verifica si el usuario activo tiene TODOS los permisos provistos.
   * @param {string[]} permissions
   */
  /**
   * Verifica si el usuario activo tiene un correo electrónico válido configurado.
   */
  hasValidEmail() {
    const user = this.getCurrentUser();
    if (!user || !user.email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email.trim());
  }

  /**
   * Solicita el envío de un código de 6 dígitos para recuperar contraseña.
   * @param {string} email
   */
  async requestPasswordReset(email) {
    return await api.post('/api/v1/auth/forgot-password', { email });
  }

  /**
   * Valida el código de 6 dígitos y obtiene el resetToken temporal.
   * @param {string} email
   * @param {string} code
   */
  async verifyResetCode(email, code) {
    const response = await api.post('/api/v1/auth/verify-reset-code', { email, code });
    if (response && response.data && response.data.resetToken) {
      return response.data.resetToken;
    }
    throw new Error(response.message || 'No se recibió el token de recuperación');
  }

  /**
   * Restablece la contraseña usando el resetToken validado.
   * @param {string} resetToken
   * @param {string} newPassword
   */
  async resetPassword(resetToken, newPassword) {
    return await api.post('/api/v1/auth/reset-password', { resetToken, newPassword });
  }

  /**
   * Cambia la contraseña de un usuario autenticado tras validar la actual.
   * @param {string} currentPassword
   * @param {string} newPassword
   */
  async changePassword(currentPassword, newPassword) {
    const response = await api.post('/api/v1/auth/change-password', { currentPassword, newPassword });
    if (response?.data?.accessToken) {
      localStorage.setItem('ardientes_token', response.data.accessToken);
    }
    return response;
  }

  /**
   * Solicita vincular o cambiar el correo enviando un código de 6 dígitos.
   * @param {string} currentPassword
   * @param {string} newEmail
   */
  async requestEmailSetup(currentPassword, newEmail) {
    return await api.post('/api/v1/auth/email-setup/request', { currentPassword, newEmail });
  }

  /**
   * Confirma el código recibido y guarda el nuevo correo en la cuenta del usuario.
   * @param {string} email
   * @param {string} code
   */
  async confirmEmailSetup(email, code) {
    const response = await api.post('/api/v1/auth/email-setup/confirm', { email, code });
    if (response && response.data && response.data.user) {
      // Actualizar perfil local en el store
      const current = store.get('currentUser') || {};
      store.set({ currentUser: { ...current, ...response.data.user } });
    }
    return response;
  }
}

export const authService = new AuthService();

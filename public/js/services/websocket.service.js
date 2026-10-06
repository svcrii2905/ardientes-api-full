/**
 * websocket.service.js — Cliente WebSocket para tiempo real en Ardientes POS
 * 
 * Gestiona:
 * - Conexión con ws://${location.host}/ws
 * - Reconexión automática con backoff exponencial (1s a 10s)
 * - Suscripción a eventos tipados (ORDER_CREATED, ORDER_STATUS_CHANGED, ORDER_CANCELLED)
 * - Heartbeat periódico (ping/pong)
 * - Resincronización al reconectar ('reconnected')
 * - Estado de conexión para la UI ('status_change')
 */

class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map(); // eventName -> Set<callback>
    this.status = 'disconnected'; // 'connected' | 'connecting' | 'disconnected'
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.isManuallyClosed = false;
    this.hasEverConnected = false;
  }

  /**
   * Inicia la conexión WebSocket.
   */
  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isManuallyClosed = false;
    this.setStatus('connecting');

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('⚡ [WS Service] Conectado a tiempo real');
        const wasReconnecting = this.hasEverConnected;
        this.hasEverConnected = true;
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.startHeartbeat();

        if (wasReconnecting) {
          this.emit('reconnected', {});
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.event) {
            this.emit(parsed.event, parsed.data);
          }
        } catch (err) {
          console.warn('⚠️ [WS Service] Error parseando mensaje:', err);
        }
      };

      this.socket.onclose = () => {
        this.stopHeartbeat();
        this.setStatus('disconnected');

        if (!this.isManuallyClosed) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (err) => {
        console.warn('⚠️ [WS Service] Error en conexión WebSocket:', err);
        // onclose se disparará automáticamente tras error
      };
    } catch (err) {
      console.error('❌ [WS Service] Fallo al iniciar WebSocket:', err);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  /**
   * Programa una reconexión con backoff exponencial.
   */
  scheduleReconnect() {
    if (this.reconnectTimer || this.isManuallyClosed) return;

    this.reconnectAttempts++;
    // Backoff exponencial: 1s, 2s, 4s, 8s, max 10s
    const delay = Math.min(1000 * Math.pow(1.6, this.reconnectAttempts - 1), 10000);

    console.log(`🔄 [WS Service] Intentando reconectar en ${(delay / 1000).toFixed(1)}s (intento #${this.reconnectAttempts})...`);
    this.setStatus('connecting');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * Heartbeat para mantener viva la conexión a través de proxies y routers.
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send('ping');
      }
    }, 25000);
  }

  stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Actualiza y notifica el estado de conexión.
   */
  setStatus(newStatus) {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.emit('status_change', { status: newStatus });
  }

  /**
   * Suscribe un callback a un evento.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} función para cancelar suscripción
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    return () => this.off(event, callback);
  }

  /**
   * Desuscribe un callback.
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emite un evento a los escuchas registrados.
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`❌ [WS Service] Error en listener de '${event}':`, err);
        }
      });
    }
  }

  /**
   * Cierra manualmente la conexión.
   */
  disconnect() {
    this.isManuallyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }
}

export const wsService = new WebSocketService();

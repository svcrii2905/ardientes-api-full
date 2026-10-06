/**
 * WebSocketHub — Administrador central de conexiones WebSocket en el servidor.
 * Permite broadcast de eventos a todos los clientes conectados (Caja, KDS, Celular).
 */

export interface WebSocketMessage {
  event: string;
  timestamp: string;
  data: unknown;
}

export class WebSocketHub {
  private readonly clients: Set<WebSocket> = new Set();

  /**
   * Registra y gestiona una nueva conexión WebSocket entrante.
   */
  handleConnection(socket: WebSocket): void {
    this.clients.add(socket);
    console.log(`⚡ [WebSocket] Nuevo cliente conectado. Total conectados: ${this.clients.size}`);

    const sendWelcome = () => {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            event: "CONNECTED",
            timestamp: new Date().toISOString(),
            data: { message: "Conectado al servidor de tiempo real de Ardientes POS" }
          }));
        }
      } catch (err) {
        console.error("❌ [WebSocket] Error enviando bienvenida:", err);
      }
    };

    if (socket.readyState === WebSocket.OPEN) {
      sendWelcome();
    } else {
      socket.onopen = () => {
        sendWelcome();
      };
    }

    socket.onmessage = (e) => {
      try {
        const raw = typeof e.data === "string" ? e.data : "";
        // Soporte para ping/pong heartbeat
        if (raw === "ping" || raw === '{"type":"ping"}') {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ event: "PONG", timestamp: new Date().toISOString() }));
          }
        }
      } catch (err) {
        console.error("❌ [WebSocket] Error procesando mensaje entrante:", err);
      }
    };

    socket.onclose = () => {
      this.clients.delete(socket);
      console.log(`🔌 [WebSocket] Cliente desconectado. Total conectados: ${this.clients.size}`);
    };

    socket.onerror = (err) => {
      console.error("⚠️ [WebSocket] Error en socket de cliente:", err);
      this.clients.delete(socket);
    };
  }

  /**
   * Emite un evento a todos los clientes WebSocket conectados.
   */
  broadcast(event: string, data: unknown): void {
    const message: WebSocketMessage = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const payload = JSON.stringify(message);
    const toRemove: WebSocket[] = [];

    for (const client of this.clients) {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        } else if (client.readyState === WebSocket.CLOSED || client.readyState === WebSocket.CLOSING) {
          toRemove.push(client);
        }
      } catch (err) {
        console.error("❌ [WebSocket] Error enviando broadcast a cliente:", err);
        toRemove.push(client);
      }
    }

    // Limpieza de sockets cerrados
    for (const dead of toRemove) {
      this.clients.delete(dead);
    }

    console.log(`📢 [WebSocket] Broadcast '${event}' enviado a ${this.clients.size} clientes`);
  }

  /**
   * Retorna el número de clientes actualmente conectados.
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

export const webSocketHub = new WebSocketHub();

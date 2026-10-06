/**
 * kds.js — Kitchen Display System (Pantalla de Cocina para Tablet)
 * 
 * Diseñado específicamente para pantallas táctiles de cocina:
 * - Botones táctiles grandes (>52px)
 * - Alto contraste y legibilidad a distancia
 * - Semáforo visual en tiempo real:
 *     0–9 min:   🟢 VERDE  (NORMAL)
 *     10–20 min: 🟡 AMARILLO (ATENCIÓN)
 *     21–29 min: 🟠 NARANJA (PRÓXIMO A DEMORARSE)
 *     30+ min:   🔴 ROJO    (⚠️ DEMORADO)
 * - Actualización local del cronómetro cada segundo (sin peticiones HTTP)
 * - Polling periódico de nuevos pedidos cada 10s
 * - No incluye cargo de desechables en la comanda
 */

import { ordersService } from '../services/orders.service.js';
import { wsService } from '../services/websocket.service.js';
import { toast } from '../utils/notify.js';
import { store } from '../store/state.js';
import { formatCurrency } from '../utils/currency.js';

let timerInterval = null;
let pollInterval = null;
let currentFilter = 'cooking'; // 'cooking' (Nuevos + En Prep), 'ready' (Listos), 'all'
let cachedOrders = [];
let wsUnsubscribers = [];
/** IDs de pedidos cuyo estado se está cambiando desde el click handler.
 *  Mientras estén aquí, el WebSocket handler NO re-renderiza para evitar
 *  la condición de carrera que destruye el botón y obliga a hacer doble clic. */
const processingOrderIds = new Set();

export async function renderKds(container) {
  // Limpiar timers previos si existieran
  clearInterval(timerInterval);
  clearInterval(pollInterval);

  container.innerHTML = `
    <div class="kds-wrapper" id="kds-screen">
      <!-- Barra Superior KDS -->
      <header class="kds-header">
        <div class="kds-header-left">
          <div class="kds-brand">
            <span class="kds-fire-icon">🍳</span>
            <div>
              <h1 class="kds-title">Cocina · KDS</h1>
              <span class="kds-subtitle">Ardientes Comidas Rápidas</span>
            </div>
          </div>

          <!-- Métricas de cocina -->
          <div class="kds-counters">
            <div class="kds-counter-item counter-prep">
              <span class="counter-num" id="kds-count-prep">0</span>
              <span class="counter-label">En Cocina</span>
            </div>
            <div class="kds-counter-item counter-ready">
              <span class="counter-num" id="kds-count-ready">0</span>
              <span class="counter-label">Listos</span>
            </div>
            <div class="kds-counter-item counter-delayed">
              <span class="counter-num" id="kds-count-delayed">0</span>
              <span class="counter-label">Demorados</span>
            </div>
          </div>
        </div>

        <div class="kds-header-right">
          <!-- Filtro de pestañas -->
          <div class="kds-tabs" id="kds-tabs">
            <button class="kds-tab-btn active" data-tab="cooking">👨‍🍳 En Cocina</button>
            <button class="kds-tab-btn" data-tab="ready">🔔 Listos</button>
            <button class="kds-tab-btn" data-tab="all">📋 Todos</button>
          </div>

          <!-- Indicador Tiempo Real -->
          <div class="kds-ws-badge ws-connected" id="kds-ws-status">🟢 En línea</div>

          <!-- Botón Pantalla Completa Tablet -->
          <button class="kds-btn-icon" id="btn-kds-fullscreen" title="Pantalla Completa">
            ⛶
          </button>

          <!-- Botón Refresco Manual -->
          <button class="kds-btn-icon" id="btn-kds-refresh" title="Actualizar">
            🔄
          </button>
        </div>
      </header>

      <!-- Área de Comandas / Tarjetas -->
      <main class="kds-body">
        <div class="kds-grid" id="kds-grid">
          <div class="kds-loading">
            <div class="spinner"></div>
            <span>Cargando comandas de cocina...</span>
          </div>
        </div>
      </main>
    </div>
  `;

  // Inicializar eventos y carga
  bindKdsEvents(container);
  await fetchKdsOrders(container);

  // Suscribirse a eventos en tiempo real vía WebSocket
  subscribeKdsWebSocket(container);

  // Intervalo local de 1s para refrescar los contadores visuales sin peticiones HTTP
  timerInterval = setInterval(() => {
    updateVisualTimers(container);
  }, 1000);

  // Intervalo de respaldo de 25s (redundancia por si se pierde conexión momentáneamente)
  pollInterval = setInterval(() => {
    fetchKdsOrders(container, true);
  }, 25000);
}

/**
 * Consulta las órdenes activas de cocina desde la API.
 */
async function fetchKdsOrders(container, silent = false) {
  const grid = container.querySelector('#kds-grid');
  if (!grid && !silent) return;

  try {
    const res = await ordersService.getKitchenOrders(false);
    cachedOrders = res.data ?? [];
    renderOrdersGrid(container);
    updateHeaderCounters(container);
  } catch (err) {
    if (!silent && grid) {
      grid.innerHTML = `
        <div class="kds-empty">
          <span style="font-size:3rem">⚠️</span>
          <h3>Error al cargar pedidos de cocina</h3>
          <p>${err.message}</p>
        </div>
      `;
    }
  }
}

/**
 * Renderiza las tarjetas de pedidos según la pestaña activa.
 */
function renderOrdersGrid(container) {
  const grid = container.querySelector('#kds-grid');
  if (!grid) return;

  let filtered = cachedOrders;
  if (currentFilter === 'cooking') {
    filtered = cachedOrders.filter(o => o.status === 'CONFIRMADO' || o.status === 'EN_PREPARACION');
  } else if (currentFilter === 'ready') {
    filtered = cachedOrders.filter(o => o.status === 'LISTO');
  } else {
    filtered = cachedOrders.filter(o => o.status === 'CONFIRMADO' || o.status === 'EN_PREPARACION' || o.status === 'LISTO');
  }

  if (filtered.length === 0) {
    const msg = currentFilter === 'ready'
      ? 'No hay pedidos listos pendientes de entrega'
      : 'No hay pedidos pendientes en cocina';
    grid.innerHTML = `
      <div class="kds-empty">
        <span style="font-size:4rem">✨</span>
        <h2>¡Cocina al día!</h2>
        <p>${msg}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(order => renderOrderCard(order)).join('');
}

/**
 * Renderiza una tarjeta individual de comanda KDS.
 */
function renderOrderCard(order) {
  const timing = calculateOrderTiming(order);
  const typeBadge = getOrderTypeBadge(order);
  const statusLabel = order.status === 'CONFIRMADO' ? 'NUEVO' : (order.status === 'EN_PREPARACION' ? 'EN PREPARACIÓN' : 'LISTO');
  const kitchenTime = order.kitchenStartedAt
    ? new Date(order.kitchenStartedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : (order.createdAt ? new Date(order.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '--:--');

  // Botón de acción principal
  let actionButtonHtml = '';
  if (order.status === 'CONFIRMADO') {
    actionButtonHtml = `
      <button class="kds-action-btn btn-start" data-action="start-prep" data-order-id="${order.id}">
        👨‍🍳 COMENZAR PREPARACIÓN
      </button>
    `;
  } else if (order.status === 'EN_PREPARACION') {
    actionButtonHtml = `
      <button class="kds-action-btn btn-ready" data-action="mark-ready" data-order-id="${order.id}">
        🔔 MARCAR COMO LISTO
      </button>
    `;
  } else if (order.status === 'LISTO') {
    actionButtonHtml = `
      <button class="kds-action-btn btn-deliver" data-action="mark-delivered" data-order-id="${order.id}">
        ✅ ENTREGAR PEDIDO
      </button>
    `;
  }

  return `
    <article class="kds-card ${timing.cardClass} status-${order.status.toLowerCase()}" data-order-id="${order.id}" data-kitchen-time="${order.kitchenStartedAt || order.createdAt || ''}">
      <!-- Encabezado de la Tarjeta -->
      <header class="kds-card-header">
        <div class="card-header-top">
          <div class="card-header-title-group">
            <span class="kds-order-num">${order.dailyOrderNumber ? `PEDIDO ${order.dailyOrderNumber}` : (order.orderNumber || '#' + order.id)}</span>
            <div class="kds-type-pill">${typeBadge}</div>
            <div class="kds-current-status-tag status-${order.status.toLowerCase()}">
              ${statusLabel}
            </div>
          </div>
          <div class="card-header-badges-group">
            <span class="kds-timer-badge ${timing.badgeClass}">
              ${timing.badgeContent}
            </span>
          </div>
        </div>
        <div class="card-header-meta">
          <div class="kds-time-pill">🕒 ${kitchenTime}</div>
          ${order.customerName ? `<div class="kds-customer-pill">👤 ${escapeHtml(order.customerName)}</div>` : ''}
          <div class="kds-paid-pill">
            ${order.paidAt 
              ? '<span class="badge" style="background:rgba(46,213,115,0.1);color:var(--status-online);font-size:0.75rem;">🟢 Pagado</span>'
              : '<span class="badge" style="background:rgba(255,165,2,0.1);color:var(--amber-500);font-size:0.75rem;">🟠 Pendiente de Pago</span>'}
          </div>
        </div>
      </header>

      <!-- Lista de Ítems / Productos -->
      <div class="kds-card-body">
        <!-- Ítems de Comida -->
        <div class="kds-items-list">
          ${(order.items || []).map(item => `
            <div class="kds-item-row">
              <div class="item-main">
                <span class="item-qty">${item.quantity}x</span>
                <span class="item-name">${escapeHtml(item.productName || 'Producto #' + item.productId)}</span>
                ${item.menuType === 'ESPECIAL' ? '<span class="item-menu-tag">Especial</span>' : ''}
                ${(item.lineTotal || item.unitPrice) ? `<span class="item-price">${formatCurrency(item.lineTotal ?? (item.unitPrice * item.quantity))}</span>` : ''}
              </div>

              <!-- Toppings seleccionados -->
              ${(item.toppings && item.toppings.length > 0) ? `
                <div class="item-toppings">
                  ${item.toppings.map(t => `
                    <span class="topping-pill">+ ${escapeHtml(t.toppingName)}</span>
                  `).join('')}
                </div>
              ` : ''}

              <!-- Observaciones del producto -->
              ${item.notes ? `
                <div class="item-note">
                  <span class="note-icon">⚠️</span>
                  <span>${escapeHtml(item.notes)}</span>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <!-- Bebidas si existen -->
        ${(order.beverages && order.beverages.length > 0) ? `
          <div class="kds-beverages-list">
            <div class="beverages-title">🥤 Bebidas:</div>
            ${order.beverages.map(b => `
              <div class="beverage-item">
                <span class="item-qty">${b.quantity}x</span>
                <span class="beverage-name">${escapeHtml(b.beverageName || 'Bebida #' + b.beverageId)}</span>
                ${(b.lineTotal || b.unitPrice) ? `<span class="beverage-price">${formatCurrency(b.lineTotal ?? (b.unitPrice * b.quantity))}</span>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Observaciones generales de la orden -->
        ${order.notes ? `
          <div class="kds-order-notes">
            <strong>Nota general:</strong> ${escapeHtml(order.notes)}
          </div>
        ` : ''}

        <!-- Total del Pedido -->
        ${order.total != null ? `
          <div class="kds-order-total-row">
            <span class="total-label">TOTAL</span>
            <span class="total-val">${formatCurrency(order.total)}</span>
          </div>
        ` : ''}
      </div>

      <!-- Pie de la Tarjeta con Botón de Acción Táctil Grande -->
      <footer class="kds-card-footer">
        ${actionButtonHtml}
      </footer>
    </article>
  `;
}

/**
 * Calcula los tiempos y el semáforo para un pedido.
 * 0–9 min:   🟢 VERDE (NORMAL)
 * 10–20 min: 🟡 AMARILLO (ATENCIÓN)
 * 21–29 min: 🟠 NARANJA (PRÓXIMO A DEMORARSE)
 * 30+ min:   🔴 ROJO (⚠️ DEMORADO)
 */
function calculateOrderTiming(order) {
  // Si ya está LISTO, detiene el contador de alerta de demora
  if (order.status === 'LISTO') {
    return {
      minutes: 0,
      badgeClass: 'timer-ready',
      cardClass: 'is-ready',
      badgeContent: '✅ LISTO',
      isDelayed: false,
    };
  }

  const dateStr = order.kitchenStartedAt || order.createdAt;
  if (!dateStr) {
    return {
      minutes: 0,
      badgeClass: 'timer-green',
      cardClass: '',
      badgeContent: '🟢 00:00',
      isDelayed: false,
    };
  }

  const start = new Date(dateStr).getTime();
  const elapsedMs = Math.max(0, Date.now() - start);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (minutes < 10) {
    return {
      minutes,
      badgeClass: 'timer-green',
      cardClass: 'card-green',
      badgeContent: `🟢 ${timeFormatted}`,
      isDelayed: false,
    };
  } else if (minutes <= 20) {
    return {
      minutes,
      badgeClass: 'timer-yellow',
      cardClass: 'card-yellow',
      badgeContent: `🟡 ${timeFormatted}`,
      isDelayed: false,
    };
  } else if (minutes < 30) {
    return {
      minutes,
      badgeClass: 'timer-orange',
      cardClass: 'card-orange',
      badgeContent: `🟠 ${timeFormatted}`,
      isDelayed: false,
    };
  } else {
    return {
      minutes,
      badgeClass: 'timer-red delayed-alert',
      cardClass: 'card-red delayed-card',
      badgeContent: `🔴 ⚠️ DEMORADO — ${timeFormatted}`,
      isDelayed: true,
    };
  }
}

/**
 * Actualiza los badges de tiempo visual en el DOM cada segundo sin rehacer peticiones.
 */
function updateVisualTimers(container) {
  const cards = container.querySelectorAll('.kds-card');
  let delayedCount = 0;

  cards.forEach(card => {
    const orderId = Number(card.dataset.orderId);
    const order = cachedOrders.find(o => o.id === orderId);
    if (!order) return;

    const timing = calculateOrderTiming(order);
    if (timing.isDelayed) delayedCount++;

    const badge = card.querySelector('.kds-timer-badge');
    if (badge && badge.innerHTML !== timing.badgeContent) {
      badge.className = `kds-timer-badge ${timing.badgeClass}`;
      badge.innerHTML = timing.badgeContent;

      // Actualizar borde de la tarjeta si cambió el semáforo
      card.classList.remove('card-green', 'card-yellow', 'card-orange', 'card-red', 'delayed-card');
      if (timing.cardClass) {
        timing.cardClass.split(' ').forEach(cls => card.classList.add(cls));
      }
    }
  });

  const delayedCounterEl = container.querySelector('#kds-count-delayed');
  if (delayedCounterEl) delayedCounterEl.textContent = delayedCount;
}

/**
 * Actualiza las métricas en la barra superior.
 */
function updateHeaderCounters(container) {
  const prepCount = cachedOrders.filter(o => o.status === 'CONFIRMADO' || o.status === 'EN_PREPARACION').length;
  const readyCount = cachedOrders.filter(o => o.status === 'LISTO').length;

  let delayedCount = 0;
  cachedOrders.forEach(o => {
    if (o.status !== 'LISTO') {
      const timing = calculateOrderTiming(o);
      if (timing.isDelayed) delayedCount++;
    }
  });

  const prepEl = container.querySelector('#kds-count-prep');
  const readyEl = container.querySelector('#kds-count-ready');
  const delayedEl = container.querySelector('#kds-count-delayed');

  if (prepEl) prepEl.textContent = prepCount;
  if (readyEl) readyEl.textContent = readyCount;
  if (delayedEl) delayedEl.textContent = delayedCount;
}

/**
 * Genera el badge visual según el tipo de pedido.
 */
function getOrderTypeBadge(order) {
  if (order.orderType === 'MESA') {
    return `🍽️ Mesa ${order.tableId ?? '?'}`;
  } else if (order.orderType === 'RECOGER') {
    return `🛍️ Para Llevar`;
  } else if (order.orderType === 'DOMICILIO') {
    return `🛵 Domicilio`;
  }
  return `📋 ${order.orderType}`;
}

/**
 * Vincula los eventos táctiles y de navegación en la vista KDS.
 */
function bindKdsEvents(container) {
  // Cambio de pestañas
  container.querySelector('#kds-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.kds-tab-btn');
    if (!btn) return;
    container.querySelectorAll('.kds-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.tab;
    renderOrdersGrid(container);
  });

  // Pantalla Completa Tablet
  container.querySelector('#btn-kds-fullscreen')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => { /* ignore */ });
    } else {
      document.exitFullscreen?.().catch(() => { /* ignore */ });
    }
  });

  // Refresco manual
  container.querySelector('#btn-kds-refresh')?.addEventListener('click', () => {
    fetchKdsOrders(container);
    toast.info('Actualizando comandas...');
  });

  // Delegación de clics en botones de acción de las tarjetas
  container.querySelector('#kds-grid')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    // Evitar clics duplicados si ya se está procesando
    if (btn.disabled) return;

    const action = btn.dataset.action;
    const orderId = Number(btn.dataset.orderId);
    const user = store.get('currentUser') || { id: 1 };

    btn.disabled = true;
    // Marcar este pedido como "en proceso" para que el WebSocket no re-renderice
    processingOrderIds.add(orderId);

    try {
      if (action === 'start-prep') {
        await ordersService.changeStatus(orderId, 'EN_PREPARACION', user.id, 'Iniciada preparación en cocina');
        toast.info(`👨‍🍳 Pedido #${orderId} en preparación`);
      } else if (action === 'mark-ready') {
        await ordersService.changeStatus(orderId, 'LISTO', user.id, 'Comida lista para entrega');
        toast.success(`🔔 Pedido #${orderId} ¡LISTO!`);
      } else if (action === 'mark-delivered') {
        await ordersService.changeStatus(orderId, 'ENTREGADO', user.id, 'Entregado al cliente/mesa');
        toast.success(`✅ Pedido #${orderId} entregado`);
      }

      // Refrescar lista de pedidos inmediatamente (fuente definitiva)
      await fetchKdsOrders(container, true);
    } catch (err) {
      toast.error(err.message || 'Error al actualizar comanda');
      btn.disabled = false;
    } finally {
      processingOrderIds.delete(orderId);
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Suscribe la pantalla KDS a los eventos de tiempo real.
 */
function subscribeKdsWebSocket(container) {
  // Limpiar suscripciones previas si existiesen
  wsUnsubscribers.forEach(unsub => unsub());
  wsUnsubscribers = [];

  // 1. Nuevo pedido creado
  wsUnsubscribers.push(
    wsService.on('ORDER_CREATED', async (data) => {
      console.log('⚡ [KDS WS] ORDER_CREATED recibido:', data);
      if (data.status === 'CONFIRMADO' || data.status === 'EN_PREPARACION') {
        const displayLabel = data.dailyOrderNumber ? `PEDIDO ${data.dailyOrderNumber}` : (data.orderNumber || `#${data.orderId}`);
        toast.info(`🔔 ¡Nuevo ${displayLabel} en cocina!`);
        playKitchenChime();
        await fetchKdsOrders(container, true);
      }
    })
  );

  // 2. Cambio de estado
  wsUnsubscribers.push(
    wsService.on('ORDER_STATUS_CHANGED', async (data) => {
      console.log('⚡ [KDS WS] ORDER_STATUS_CHANGED recibido:', data);
      const idx = cachedOrders.findIndex(o => o.id === data.orderId);
      if (idx !== -1) {
        // Actualizar la caché local siempre
        if (data.newStatus === 'ENTREGADO') {
          cachedOrders.splice(idx, 1);
        } else {
          cachedOrders[idx].status = data.newStatus;
          if (data.kitchenStartedAt && !cachedOrders[idx].kitchenStartedAt) {
            cachedOrders[idx].kitchenStartedAt = data.kitchenStartedAt;
          }
        }
        // Si este pedido está siendo procesado por el click handler,
        // NO re-renderizar aquí — el click handler hará fetchKdsOrders
        // al terminar, evitando la carrera que destruye el botón.
        if (processingOrderIds.has(data.orderId)) {
          updateHeaderCounters(container);
          return;
        }
        renderOrdersGrid(container);
        updateHeaderCounters(container);
      } else if (data.newStatus === 'CONFIRMADO' || data.newStatus === 'EN_PREPARACION') {
        // Pedido recién entra a cocina (e.g. pagado en caja)
        const displayLabel = data.dailyOrderNumber ? `PEDIDO ${data.dailyOrderNumber}` : (data.orderNumber || `#${data.orderId}`);
        toast.info(`🔔 ¡Nuevo ${displayLabel} en cocina!`);
        playKitchenChime();
        await fetchKdsOrders(container, true);
      }
    })
  );

  // 3. Cancelación de pedido
  wsUnsubscribers.push(
    wsService.on('ORDER_CANCELLED', (data) => {
      console.log('⚡ [KDS WS] ORDER_CANCELLED recibido:', data);
      const idx = cachedOrders.findIndex(o => o.id === data.orderId);
      if (idx !== -1) {
        cachedOrders.splice(idx, 1);
        renderOrdersGrid(container);
        updateHeaderCounters(container);
        const displayLabel = data.dailyOrderNumber ? `PEDIDO ${data.dailyOrderNumber}` : (data.orderNumber || `#${data.orderId}`);
        toast.warning(`⚠️ ${displayLabel} cancelado`);
      }
    })
  );

  // 4. Reconexión automática
  wsUnsubscribers.push(
    wsService.on('reconnected', async () => {
      console.log('⚡ [KDS WS] Reconectado — Resincronizando comandas...');
      await fetchKdsOrders(container, true);
    })
  );

  // 5. Cambio en el estado de conexión
  wsUnsubscribers.push(
    wsService.on('status_change', ({ status }) => {
      const el = container.querySelector('#kds-ws-status');
      if (!el) return;
      if (status === 'connected') {
        el.className = 'kds-ws-badge ws-connected';
        el.textContent = '🟢 En línea';
      } else if (status === 'connecting') {
        el.className = 'kds-ws-badge ws-connecting';
        el.textContent = '🟡 Reconectando...';
      } else {
        el.className = 'kds-ws-badge ws-disconnected';
        el.textContent = '⚪ Sin conexión';
      }
    })
  );
}

/**
 * Alerta auditiva opcional con Web Audio API cuando llega un pedido.
 */
function playKitchenChime() {
  try {
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Web Audio puede requerir interacción previa del usuario
  }
}

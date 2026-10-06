/**
 * sidebar.js — Sidebar de navegación con indicador de API
 */
import { store } from '../store/state.js';
import { api } from '../services/api.service.js';
import { authService } from '../services/auth.service.js';
import { wsService } from '../services/websocket.service.js';
import { CONFIG } from '../config.js';

const NAV_ITEMS = [
  { view: 'pos',       icon: '🔥', label: 'Punto de Venta' },
  { view: 'waiter',    icon: '🤵', label: 'Mesas / Mesero' },
  { view: 'kds',       icon: '🍳', label: 'Cocina (KDS)' },
  { view: 'orders',    icon: '🧾', label: 'Pedidos' },
  { view: 'products',  icon: '🍔', label: 'Productos' },
  { view: 'inventory', icon: '📦', label: 'Inventario' },
  { view: 'customers', icon: '👥', label: 'Clientes' },
  { view: 'cash',      icon: '💰', label: 'Caja' },
  { view: 'settings',  icon: '⚙️',  label: 'Configuración' },
];

export function renderSidebar(container) {
  container.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <!-- Logo -->
      <div class="sidebar-logo" id="nav-logo">
        <div class="logo-img" id="logo-circle" style="
          width:42px; height:42px; border-radius:50%;
          background: linear-gradient(135deg,#FF5500,#FF9900);
          display:flex; align-items:center; justify-content:center;
          font-size:1.4rem; flex-shrink:0;">🔥</div>
        <div class="sidebar-logo-text">
          <span class="sidebar-logo-name">ARDIENTES</span>
          <span class="sidebar-logo-sub">COMIDAS RÁPIDAS</span>
        </div>
      </div>

      <!-- Navegación -->
      <nav class="sidebar-nav" id="sidebar-nav">
        ${NAV_ITEMS.filter(item => {
          switch (item.view) {
            case 'pos':       return authService.hasPermission('orders:create');
            case 'waiter':    return authService.hasPermission('tables:read');
            case 'kds':       return authService.hasPermission('orders:update_status');
            case 'orders':    return authService.hasPermission('orders:create') || authService.hasPermission('orders:cancel');
            case 'products':  return authService.hasPermission('catalog:manage');
            case 'inventory': return authService.hasPermission('inventory:read');
            case 'customers': return authService.hasPermission('customers:manage');
            case 'cash':      return authService.hasPermission('cash_session:open') || authService.hasPermission('cash_session:close');
            case 'settings':  return authService.hasPermission('config:write');
            default:          return false;
          }
        }).map(item => `
          <button class="nav-item" data-view="${item.view}" id="nav-${item.view}">
            <span class="nav-icon">${item.icon}</span>
            <span>${item.label}</span>
          </button>
        `).join('')}
      </nav>

      <!-- Footer con indicador de API -->
      <div class="sidebar-footer">
        <div class="api-indicator" id="api-indicator">
          <div class="api-dot" id="api-dot"></div>
          <span id="api-status-text">Verificando...</span>
        </div>
      </div>
    </aside>
  `;

  // Delegación de eventos de navegación
  container.querySelector('#sidebar-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    store.set({ activeView: btn.dataset.view });
  });

  // Actualizar estilos al cambiar la vista activa
  store.subscribe('activeView', (view) => {
    container.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
  });

  // Activar ítem inicial
  const initial = store.get('activeView');
  container.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === initial);
  });

  // Monitor de conexión con la API y WebSocket
  monitorApiHealth(container);
}

async function monitorApiHealth(container) {
  const dot  = container.querySelector('#api-dot');
  const text = container.querySelector('#api-status-text');
  if (!dot || !text) return;

  const updateDisplay = (status) => {
    if (status === 'connected') {
      dot.className = 'api-dot online';
      text.textContent = '🟢 En línea';
      text.style.color = 'var(--status-online)';
    } else if (status === 'connecting') {
      dot.className = 'api-dot connecting';
      text.textContent = '🟡 Reconectando...';
      text.style.color = '#F59E0B';
    } else {
      dot.className = 'api-dot offline';
      text.textContent = '⚪ Sin conexión';
      text.style.color = 'var(--status-offline)';
    }
  };

  updateDisplay(wsService.status);
  wsService.on('status_change', ({ status }) => updateDisplay(status));

  // Chequeo periódico de salud HTTP
  async function check() {
    const online = await api.checkHealth();
    store.set({ apiOnline: online });
    if (!online) {
      updateDisplay('disconnected');
    }
  }

  await check();
  setInterval(check, CONFIG.HEALTH_CHECK_INTERVAL);
}

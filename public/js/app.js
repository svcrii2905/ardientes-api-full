/**
 * app.js — Router SPA principal de Ardientes POS
 * Gestiona la navegación entre vistas sin recarga de página.
 */
import { store } from './store/state.js';
import { renderSidebar } from './components/sidebar.js';
import { renderPos } from './components/pos.js?v=7';
import { renderOrders } from './components/orders.js';
import { renderProducts } from './components/products.js';
import { renderInventory } from './components/inventory.js';
import { renderCustomers } from './components/customers.js';
import { renderCash } from './components/cash.js?v=8';
import { renderKds } from './components/kds.js?v=3';
import { renderWaiterView } from './components/waiter.js?v=2';
import { authService } from './services/auth.service.js';
import { renderLogin } from './components/login.js';
import { renderAccessSelection } from './components/accessSelection.js';
import { renderCustomerAuth } from './components/customerAuth.js';
import { renderCustomerPortal } from './components/customerPortal.js';
import { customerAuthService } from './services/customerAuth.service.js';
import { openEmailSetupModal } from './components/emailSetupModal.js';
import { openChangePasswordModal } from './components/changePasswordModal.js';
import { cashService } from './services/cash.service.js';
import { wsService } from './services/websocket.service.js';

const VIEWS = {
  pos:       renderPos,
  waiter:    renderWaiterView,
  kds:       renderKds,
  orders:    renderOrders,
  products:  renderProducts,
  inventory: renderInventory,
  customers: renderCustomers,
  cash:      renderCash,
  settings:  renderSettings,
};

async function showCustomerFlow(app) {
  if (customerAuthService.getToken()) {
    try {
      await customerAuthService.fetchMe();
      renderCustomerPortal(app, {
        onLogout: () => showCustomerFlow(app),
        onBack: () => showAccessSelection(app),
      });
      return;
    } catch (_err) {
      customerAuthService.clearSession();
    }
  }

  renderCustomerAuth(app, {
    onBack: () => showAccessSelection(app),
    onSuccess: () => {
      renderCustomerPortal(app, {
        onLogout: () => showCustomerFlow(app),
        onBack: () => showAccessSelection(app),
      });
    },
  });
}

function showAccessSelection(app) {
  renderAccessSelection(app, {
    onSelectStaff: () => {
      renderLogin(
        app,
        () => startAppFlow(app),
        () => showAccessSelection(app)
      );
    },
    onSelectCustomer: () => {
      showCustomerFlow(app);
    }
  });
}

async function init() {
  const app = document.getElementById('app');
  if (!app) return;

  globalThis.addEventListener('auth:unauthorized', () => {
    authService.clearSession();
    startAppFlow(app);
  });

  await startAppFlow(app);
}

async function startAppFlow(app) {
  if (!authService.getToken()) {
    showAccessSelection(app);
    return;
  }

  try {
    await authService.fetchMe();
  } catch (_err) {
    authService.clearSession();
    showAccessSelection(app);
    return;
  }

  // ── Estructura base del layout ────────────────────────────────────
  app.innerHTML = `
    <div id="sidebar-mount"></div>
    <div class="main-area">
      <header class="header" id="main-header">
        <div class="header-left">
          <div>
            <h1 class="header-title" id="header-title">🔥 Punto de Venta</h1>
          </div>
        </div>
        <div class="header-right">
          <!-- Badge de sesión de caja -->
          <div id="cash-session-badge" class="header-cash-badge" style="display:none">
            <span class="cash-badge-dot">●</span>
            <span id="cash-badge-text">Caja #—</span>
          </div>
          <div class="header-session-info" style="cursor:pointer; position:relative" id="user-menu-btn">
            <span class="header-session-label" id="header-roles">Cargando...</span>
            <span class="header-session-value" id="header-user">Usuario</span>
            <div id="user-dropdown" style="
              display:none; position:absolute; top:100%; right:0; margin-top:0.5rem;
              background:var(--bg-panel); border:1px solid var(--border-subtle);
              border-radius:var(--radius-md); box-shadow:0 4px 12px rgba(0,0,0,0.3);
              padding:var(--space-2) 0; z-index:100; min-width:210px;
            ">
              <button id="btn-setup-email" class="btn btn-ghost" style="width:100%; justify-content:flex-start; padding:var(--space-2) var(--space-4); border-radius:0; font-size:var(--text-sm);">📧 Configurar / Cambiar correo</button>
              <button id="btn-change-password" class="btn btn-ghost" style="width:100%; justify-content:flex-start; padding:var(--space-2) var(--space-4); border-radius:0; font-size:var(--text-sm);">🔑 Cambiar contraseña</button>
              <button id="btn-change-user" class="btn btn-ghost" style="width:100%; justify-content:flex-start; padding:var(--space-2) var(--space-4); border-radius:0; font-size:var(--text-sm);">Cambiar usuario</button>
              <button id="btn-logout" class="btn btn-ghost" style="width:100%; justify-content:flex-start; padding:var(--space-2) var(--space-4); border-radius:0; font-size:var(--text-sm); color:var(--status-offline);">Cerrar sesión</button>
            </div>
          </div>
          <div class="header-session-info">
            <span class="header-session-label">Hora</span>
            <span class="header-session-value" id="header-clock">--:--</span>
          </div>
        </div>
      </header>
      <div class="content-area" id="view-mount"></div>
    </div>
  `;

  // Configurar Dropdown de usuario
  const userMenuBtn = app.querySelector('#user-menu-btn');
  const userDropdown = app.querySelector('#user-dropdown');
  userMenuBtn.addEventListener('click', (e) => {
    if (e.target.closest('#user-dropdown')) return;
    userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#user-menu-btn')) {
      if (userDropdown) userDropdown.style.display = 'none';
    }
  });

  app.querySelector('#btn-setup-email').addEventListener('click', () => {
    if (userDropdown) userDropdown.style.display = 'none';
    openEmailSetupModal({ mandatory: false });
  });

  app.querySelector('#btn-change-password').addEventListener('click', () => {
    if (userDropdown) userDropdown.style.display = 'none';
    openChangePasswordModal();
  });

  app.querySelector('#btn-logout').addEventListener('click', async () => {
    await authService.logout();
    startAppFlow(app);
  });

  app.querySelector('#btn-change-user').addEventListener('click', async () => {
    await authService.logout();
    startAppFlow(app);
  });

  // Renderizar datos del usuario actual
  updateHeaderUser();

  // Si el usuario recién autenticado no tiene correo válido configurado, invitarlo a configurarlo
  if (!authService.hasValidEmail()) {
    setTimeout(() => {
      openEmailSetupModal({ mandatory: true });
    }, 600);
  }

  // ── Renderizar sidebar ───────────────────────────────────────────
  renderSidebar(app.querySelector('#sidebar-mount'));

  // ── Reloj en el header ───────────────────────────────────────────
  startClock();

  // ── Iniciar conexión en tiempo real vía WebSocket ───────────────
  wsService.connect();

  // ── Precargar sesión de caja activa ─────────────────────────────
  try {
    const session = await cashService.getActiveSession({ registerId: 1 });
    store.set({ cashSession: session });
    updateCashBadge(session);
  } catch { /* no crítico al inicio */ }

  // Actualizar badge cuando cambie la sesión de caja
  store.subscribe('cashSession', updateCashBadge);

  // ── Suscribirse a cambios de vista ───────────────────────────────
  store.subscribe('activeView', async (view) => {
    updateHeaderTitle(view);
    await navigateTo(view, app.querySelector('#view-mount'));
  });

  // ── Cargar vista inicial ──────────────────────────────────────────
  await navigateTo(store.get('activeView'), app.querySelector('#view-mount'));
}

const VIEW_TITLES = {
  pos:       '🔥 Punto de Venta',
  waiter:    '🤵 Mesas / Mesero',
  kds:       '🍳 Cocina (KDS)',
  orders:    '🧾 Pedidos',
  products:  '🍔 Productos',
  inventory: '📦 Inventario',
  customers: '👥 Clientes',
  cash:      '💰 Caja',
  settings:  '⚙️ Configuración',
};

function updateHeaderTitle(view) {
  const el = document.getElementById('header-title');
  if (el) el.textContent = VIEW_TITLES[view] || '🔥 Ardientes POS';
}

function updateHeaderUser() {
  const user = authService.getCurrentUser();
  const nameEl = document.getElementById('header-user');
  const rolesEl = document.getElementById('header-roles');
  
  if (user && nameEl && rolesEl) {
    nameEl.textContent = user.fullName || user.username;
    rolesEl.textContent = user.roles ? user.roles.join(' · ') : 'Usuario';
  }
}

function navigateTo(view, mount) {
  if (!mount) return;
  const renderer = VIEWS[view];
  if (!renderer) return;

  // Verificación de Permisos (Client-side UI Guard)
  let allowed = true;
  switch (view) {
    case 'pos':       allowed = authService.hasPermission('orders:create'); break;
    case 'waiter':    allowed = authService.hasPermission('tables:read'); break;
    case 'kds':       allowed = authService.hasPermission('orders:update_status'); break;
    case 'orders':    allowed = authService.hasPermission('orders:create') || authService.hasPermission('orders:cancel'); break;
    case 'products':  allowed = authService.hasPermission('catalog:manage'); break;
    case 'inventory': allowed = authService.hasPermission('inventory:read'); break;
    case 'customers': allowed = authService.hasPermission('customers:manage'); break;
    case 'cash':      allowed = authService.hasPermission('cash_session:open') || authService.hasPermission('cash_session:close'); break;
    case 'settings':  allowed = authService.hasPermission('config:write'); break;
  }

  // Fade out suave
  mount.style.opacity = '0';
  mount.style.transform = 'translateY(6px)';
  mount.style.transition = 'opacity 150ms ease, transform 150ms ease';

  setTimeout(async () => {
    mount.innerHTML = '';
    if (!allowed) {
      renderAccessDenied(mount);
    } else {
      await renderer(mount);
    }
    mount.style.opacity = '1';
    mount.style.transform = 'translateY(0)';
  }, 150);
}

function renderAccessDenied(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted)">
      <div style="font-size:3rem;margin-bottom:1rem">🚫</div>
      <h2 style="color:var(--text-main);margin-bottom:0.5rem">Acceso Denegado</h2>
      <p>No tienes permisos suficientes para ver esta sección.</p>
    </div>
  `;
}

function startClock() {
  function tick() {
    const el = document.getElementById('header-clock');
    if (el) {
      el.textContent = new Date().toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit'
      });
    }
  }
  tick();
  setInterval(tick, 1000);
}

function renderSettings(container) {
  container.innerHTML = `
    <div class="page-layout">
      <div class="page-header">
        <h1 class="page-title">⚙️ Configuración</h1>
      </div>
      <div class="page-body">
        <div style="max-width:500px">
          <div class="panel" style="display:flex;flex-direction:column;gap:var(--space-5)">
            <div>
              <h2 style="font-size:var(--text-lg);margin-bottom:var(--space-2)">Ardientes POS</h2>
              <p style="color:var(--text-muted);font-size:var(--text-sm)">
                Sistema de Punto de Venta — Versión 1.0
              </p>
            </div>
            <div style="display:flex;flex-direction:column;gap:var(--space-3)">
              ${[
                ['🌐', 'Backend',     'Deno + Oak + TypeScript'],
                ['🗄️', 'Base de datos', 'MySQL 8.0 — ardientes_pos'],
                ['💱', 'Moneda',      'COP — Peso colombiano'],
                ['💸', 'Impuesto',    '8% Impoconsumo (incluido)'],
              ].map(([icon, lbl, val]) => `
                <div style="display:flex;align-items:center;gap:var(--space-3);
                            padding:var(--space-3) 0;border-bottom:1px solid var(--border-subtle)">
                  <span style="font-size:1.25rem;width:2rem;text-align:center">${icon}</span>
                  <div>
                    <p style="font-size:var(--text-xs);color:var(--text-muted)">${lbl}</p>
                    <p style="font-size:var(--text-sm);font-weight:600">${val}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateCashBadge(session) {
  const badge  = document.getElementById('cash-session-badge');
  const text   = document.getElementById('cash-badge-text');
  if (!badge || !text) return;

  if (session && session.id) {
    badge.style.display = 'flex';
    text.textContent = `Caja #${session.registerId} · Sesión #${session.id}`;
  } else {
    badge.style.display = 'none';
  }
}

// Iniciar la app
init();

/**
 * customerPortal.js — Portal de Clientes de Ardientes POS
 * Muestra el perfil seguro del cliente autenticado utilizando exclusivamente /api/v1/client/me.
 * No inventa endpoints ni datos ficticios.
 */
import { customerAuthService } from '../services/customerAuth.service.js';
import { toast } from '../utils/notify.js';
import { renderCustomerOrder } from './customerOrder.js';

export async function renderCustomerPortal(container, { onLogout, onBack } = {}) {
  container.innerHTML = `
    <div style="
      position: fixed; inset: 0; z-index: 9999;
      background: var(--bg-body, #100A06);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: var(--space-4, 16px);
      box-sizing: border-box;
      overflow-y: auto;
      overflow-x: hidden;
    ">
      <div style="
        width: 100%; max-width: 460px;
        display: flex; flex-direction: column; gap: var(--space-4, 16px);
        box-sizing: border-box; margin: auto;
      ">
        <div class="spinner" style="margin: var(--space-10) auto; width: 36px; height: 36px;"></div>
        <p style="text-align: center; color: var(--text-secondary); font-size: 0.9rem;">Cargando tu información...</p>
      </div>
    </div>
  `;

  let customer = null;
  try {
    customer = await customerAuthService.fetchMe();
  } catch (_err) {
    toast.error('Sesión expirada o inválida. Por favor ingresa nuevamente.');
    customerAuthService.logout();
    if (onLogout) onLogout();
    return;
  }

  // Formatear moneda COP
  const formattedSpent = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(customer.totalSpent || 0);

  // Formatear fecha
  const formattedCreatedAt = customer.createdAt
    ? new Date(customer.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Reciente';

  const formattedLastLogin = customer.lastLoginAt
    ? new Date(customer.lastLoginAt).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Primer inicio';

  container.innerHTML = `
    <div style="
      position: fixed; inset: 0; z-index: 9999;
      background: var(--bg-body, #100A06);
      display: flex; flex-direction: column; align-items: center;
      padding: var(--space-4, 16px);
      box-sizing: border-box;
      overflow-y: auto;
      overflow-x: hidden;
    ">
      <div style="
        width: 100%; max-width: 480px;
        display: flex; flex-direction: column; gap: var(--space-4, 16px);
        box-sizing: border-box; margin: 0 auto var(--space-6) auto;
      ">
        <!-- Barra Superior: Volver y Cerrar Sesión -->
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          ${onBack ? `
            <button type="button" id="btn-portal-back" style="
              background: transparent; border: none;
              color: var(--text-secondary, #C8A98A); font-size: 0.85rem; font-weight: 600;
              cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
              padding: 6px 8px; border-radius: var(--radius-md, 8px);
            ">
              <span>←</span>
              <span>Inicio</span>
            </button>
          ` : '<div></div>'}

          <button type="button" id="btn-portal-logout" style="
            background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3);
            color: #FF8888; font-size: 0.82rem; font-weight: 700;
            cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
            padding: 6px 12px; border-radius: var(--radius-md, 8px);
            transition: all 150ms ease;
          ">
            <span>Cerrar sesión</span>
            <span>🚪</span>
          </button>
        </div>

        <!-- Tarjeta de Bienvenida y Perfil -->
        <div class="panel" style="
          padding: var(--space-5, 20px);
          background: var(--bg-surface, #1C1008);
          border: 1px solid var(--border-medium, rgba(255, 100, 20, 0.25));
          border-radius: var(--radius-lg, 12px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          display: flex; flex-direction: column; gap: var(--space-4, 16px);
          box-sizing: border-box;
        ">
          <!-- Cabecera del Usuario -->
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="
              width: 56px; height: 56px; border-radius: 50%;
              background: linear-gradient(135deg, #FF5500, #FF9900);
              display: flex; align-items: center; justify-content: center;
              font-size: 1.8rem; flex-shrink: 0;
              box-shadow: 0 0 25px rgba(255, 85, 0, 0.35);
            ">🧑</div>
            <div style="flex: 1; min-width: 0;">
              <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--amber-400); font-weight: 700; letter-spacing: 0.5px;">
                Cliente Ardientes
              </span>
              <h1 style="
                font-family: 'Outfit', sans-serif; font-size: 1.35rem; font-weight: 800;
                color: var(--text-primary, #FFF5EE); margin: 0; line-height: 1.2;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
              ">${customer.fullName}</h1>
              <p style="font-size: 0.82rem; color: var(--text-secondary, #C8A98A); margin: 2px 0 0 0; font-family: monospace;">
                📞 ${customer.phone}
              </p>
            </div>
          </div>

          <!-- BOTÓN PRINCIPAL: 🛒 HACER PEDIDO -->
          <button type="button" id="btn-portal-make-order" style="
            width: 100%;
            background: linear-gradient(135deg, #FF5500, #FF7733);
            border: none; border-radius: var(--radius-lg, 12px);
            padding: 16px 20px;
            color: #FFF; font-family: 'Outfit', sans-serif;
            font-size: 1.15rem; font-weight: 900;
            display: flex; align-items: center; justify-content: space-between;
            box-shadow: 0 8px 25px rgba(255, 85, 0, 0.45);
            cursor: pointer; transition: all 150ms ease;
          ">
            <div style="display:flex; align-items:center; gap: 10px;">
              <span style="font-size: 1.4rem;">🛒</span>
              <span>HACER PEDIDO</span>
            </div>
            <span style="font-size: 1.2rem;">➔</span>
          </button>

          <!-- Saldo Real de Puntos de Fidelización -->
          <div style="
            background: linear-gradient(135deg, rgba(255, 85, 0, 0.16), rgba(255, 165, 0, 0.06));
            border: 1px solid rgba(255, 85, 0, 0.35); border-radius: var(--radius-md, 10px);
            padding: var(--space-4, 16px);
            display: flex; flex-direction: column; gap: var(--space-2, 8px);
          ">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <span style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700;">
                  Tus Puntos Acumulados
                </span>
                <div style="
                  font-family: 'Outfit', sans-serif; font-size: 2.2rem; font-weight: 900;
                  color: var(--fire-400, #FF7733); line-height: 1.1; margin-top: 4px;
                ">
                  🔥 ${customer.loyaltyPoints ?? 0}
                  <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-muted);">pts</span>
                </div>
              </div>
              <div style="text-align: right;">
                <span class="badge badge-fire" style="font-size: 0.72rem; padding: 4px 8px;">
                  Programa Fidelización
                </span>
              </div>
            </div>

            <p style="font-size: 0.78rem; color: var(--text-secondary); margin: 4px 0 0 0; line-height: 1.4;">
              Acumula puntos en cada compra en nuestro local dictando tu número telefónico en Caja.
            </p>
          </div>

          <!-- Métricas Reales de Cuenta -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3, 12px);">
            <!-- Total de Pedidos -->
            <div style="
              background: rgba(0, 0, 0, 0.25); border: 1px solid var(--border-subtle, rgba(255, 100, 20, 0.12));
              border-radius: var(--radius-md, 8px); padding: 12px;
            ">
              <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase;">
                Pedidos en Local
              </span>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin-top: 4px;">
                🛍️ ${customer.totalOrders ?? 0}
              </div>
            </div>

            <!-- Total Gastado -->
            <div style="
              background: rgba(0, 0, 0, 0.25); border: 1px solid var(--border-subtle, rgba(255, 100, 20, 0.12));
              border-radius: var(--radius-md, 8px); padding: 12px;
            ">
              <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase;">
                Total Consumido
              </span>
              <div style="font-size: 1.1rem; font-weight: 800; color: var(--amber-400); margin-top: 4px;">
                ${formattedSpent}
              </div>
            </div>
          </div>

          <!-- Detalles de la Cuenta -->
          <div style="
            background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border-subtle, rgba(255, 100, 20, 0.1));
            border-radius: var(--radius-md, 8px); padding: 12px;
            display: flex; flex-direction: column; gap: 8px; font-size: 0.8rem;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-muted);">Correo:</span>
              <span style="color: var(--text-primary); font-weight: 600;">${customer.email || 'No registrado'}</span>
            </div>
            ${customer.address ? `
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-muted);">Dirección:</span>
                <span style="color: var(--text-primary); font-weight: 600;">${customer.address}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-muted);">Miembro desde:</span>
              <span style="color: var(--text-secondary);">${formattedCreatedAt}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-muted);">Último acceso:</span>
              <span style="color: var(--text-secondary);">${formattedLastLogin}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind Events
  const backBtn = container.querySelector('#btn-portal-back');
  if (backBtn && onBack) {
    backBtn.addEventListener('click', onBack);
  }

  const makeOrderBtn = container.querySelector('#btn-portal-make-order');
  if (makeOrderBtn) {
    makeOrderBtn.addEventListener('click', () => {
      renderCustomerOrder(container, {
        onBack: () => renderCustomerPortal(container, { onLogout, onBack }),
      });
    });
  }

  const logoutBtn = container.querySelector('#btn-portal-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      customerAuthService.logout();
      toast.info('Has cerrado sesión correctamente.');
      if (onLogout) onLogout();
    });
  }
}


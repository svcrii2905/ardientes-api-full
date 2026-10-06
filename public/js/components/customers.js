/**
 * customers.js — Gestión de Clientes y Programa de Fidelización (Ardientes POS)
 */
import { customersService } from '../services/customers.service.js';
import { toast } from '../utils/notify.js';
import { store } from '../store/state.js';
import { openCustomerActivationModal } from './customerActivationModal.js';

export async function renderCustomers(container) {
  container.innerHTML = `
    <div class="page-layout">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h1 class="page-title">👥 Clientes y Fidelización</h1>
          <p style="font-size:var(--text-xs);color:var(--text-muted);margin-top:2px;">
            Consulta clientes, gestiona puntos de fidelización y canjea hamburguesas gratis
          </p>
        </div>
        <button class="btn btn-primary" id="btn-open-create-customer">
          ➕ Nuevo Cliente
        </button>
      </div>

      <div class="page-body" style="display:grid;grid-template-columns:1fr 380px;gap:var(--space-5);">
        
        <!-- Panel Izquierdo: Buscador y Lista de Clientes -->
        <div style="display:flex;flex-direction:column;gap:var(--space-4);">
          <div style="display:flex;gap:var(--space-3);">
            <div class="search-wrap" style="flex:1;">
              <span class="search-icon">🔍</span>
              <input class="input input-search" id="input-customer-search"
                     placeholder="Buscar por teléfono o nombre..." autocomplete="off" />
            </div>
            <button class="btn btn-secondary" id="btn-refresh-customers">🔄</button>
          </div>

          <div id="customers-list-wrap" style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);overflow:hidden;">
            <div style="text-align:center;padding:var(--space-10);color:var(--text-muted);">
              <div class="spinner" style="margin:0 auto var(--space-4);"></div>
              Cargando clientes...
            </div>
          </div>
        </div>

        <!-- Panel Derecho: Detalle y Fidelización del Cliente Seleccionado -->
        <div id="customer-detail-wrap">
          <div class="panel" style="text-align:center;padding:var(--space-8);color:var(--text-muted);">
            <div style="font-size:3rem;margin-bottom:var(--space-3);">👤</div>
            <p style="font-weight:600;">Selecciona un cliente para ver su estado de puntos e historial</p>
          </div>
        </div>

      </div>
    </div>
  `;

  let currentCustomers = [];
  let selectedCustomer = null;

  async function loadCustomers(query = '') {
    const wrap = container.querySelector('#customers-list-wrap');
    try {
      currentCustomers = await customersService.search(query, 30);
      renderCustomersTable(wrap, currentCustomers);
    } catch (e) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <p>Error al cargar clientes: ${e.message}</p>
        </div>`;
    }
  }

  function renderCustomersTable(wrap, customers) {
    if (!customers.length) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <p>No se encontraron clientes registrados</p>
        </div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="data-table" id="customers-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Teléfono</th>
            <th>Puntos</th>
            <th>Premios</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          ${customers.map(c => {
            const rewards = Math.floor((c.loyaltyPoints || 0) / 10);
            return `
              <tr data-customer-id="${c.id}" style="cursor:pointer;" class="${selectedCustomer?.id === c.id ? 'selected-row' : ''}">
                <td style="font-weight:700;">${c.fullName}</td>
                <td style="color:var(--text-secondary);font-family:monospace;">${c.phone}</td>
                <td>
                  <span class="badge badge-fire" style="font-size:11px;">
                    🔥 ${c.loyaltyPoints} pts
                  </span>
                </td>
                <td>
                  ${rewards > 0 ? `
                    <span class="badge badge-green" style="font-size:11px;">
                      🎉 ${rewards} gratis
                    </span>
                  ` : `<span style="font-size:11px;color:var(--text-muted);">-</span>`}
                </td>
                <td>
                  <button class="btn btn-secondary btn-sm btn-select-customer" data-id="${c.id}">
                    Ver Detalle
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll('.btn-select-customer').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        await selectCustomer(id);
      });
    });

    wrap.querySelectorAll('tbody tr').forEach(row => {
      row.addEventListener('click', async () => {
        const id = Number(row.dataset.customerId);
        await selectCustomer(id);
      });
    });
  }

  async function selectCustomer(id) {
    const detailWrap = container.querySelector('#customer-detail-wrap');
    detailWrap.innerHTML = `
      <div class="panel" style="text-align:center;padding:var(--space-8);color:var(--text-muted);">
        <div class="spinner" style="margin:0 auto var(--space-4);"></div>
        Cargando historial de puntos...
      </div>`;

    try {
      const loyalty = await customersService.getLoyalty(id);
      selectedCustomer = loyalty;

      const points = loyalty.points;
      const progressPercent = Math.min(100, ((points % 10) / 10) * 100);

      detailWrap.innerHTML = `
        <div class="panel" style="display:flex;flex-direction:column;gap:var(--space-4);">
          <!-- Info Cabecera -->
          <div style="border-bottom:1px solid var(--border-subtle);padding-bottom:var(--space-3);">
            <h2 style="font-size:var(--text-lg);font-weight:800;color:var(--text-primary);margin:0;">
              ${loyalty.fullName}
            </h2>
            <p style="font-size:var(--text-xs);color:var(--text-secondary);margin:2px 0 0 0;">
              📞 ${loyalty.phone}
            </p>
          </div>

          <!-- Tarjeta de Puntos y Recompensas -->
          <div style="background:linear-gradient(135deg, rgba(255,100,0,0.1), rgba(255,165,0,0.05));
                      border:1px solid rgba(255,100,0,0.3);border-radius:var(--radius-lg);padding:var(--space-4);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <span style="font-size:var(--text-xs);color:var(--text-secondary);text-transform:uppercase;font-weight:700;">
                  Saldo de Fidelización
                </span>
                <div style="font-size:2rem;font-weight:900;color:var(--fire-400);line-height:1.1;margin-top:2px;">
                  🔥 ${points} <span style="font-size:var(--text-sm);color:var(--text-muted);">pts</span>
                </div>
              </div>
              ${loyalty.availableRewards > 0 ? `
                <button class="btn btn-primary btn-sm" id="btn-customer-redeem" style="font-weight:800;">
                  🎁 Canjear Hamburguesa
                </button>
              ` : ''}
            </div>

            <!-- Barra de Progreso hacia la próxima hamburguesa -->
            <div style="margin-top:var(--space-3);">
              <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:4px;">
                <span>Progreso hacia premio (10 pts)</span>
                <span>${points % 10} / 10</span>
              </div>
              <div style="height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${progressPercent}%;background:linear-gradient(90deg, var(--fire-500), var(--amber-400));border-radius:4px;transition:width 300ms ease;"></div>
              </div>
              <p style="font-size:11px;color:var(--text-muted);margin:6px 0 0 0;">
                ${loyalty.statusMessage}
              </p>
            </div>
          </div>

          <!-- Botón de usar en pedido actual -->
          <button class="btn btn-secondary btn-sm" id="btn-use-customer-in-cart" style="width:100%;">
            🛒 Asignar a Pedido Actual en Caja
          </button>

          <!-- Botón para generar código de activación web -->
          <button class="btn btn-secondary btn-sm" id="btn-generate-activation-code" style="
            width:100%; border-color:rgba(255,165,0,0.3); color:var(--amber-300); font-weight:700;
          ">
            🔑 Generar Código Web
          </button>

          <!-- Historial de Movimientos de Puntos -->
          <div>
            <h3 style="font-size:var(--text-xs);font-weight:800;color:var(--text-secondary);text-transform:uppercase;margin-bottom:var(--space-2);">
              📜 Historial de Movimientos
            </h3>
            <div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
              ${loyalty.history && loyalty.history.length ? loyalty.history.map(tx => {
                const isGain = tx.pointsDelta > 0;
                const dateStr = tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                return `
                  <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-input);padding:6px 10px;border-radius:var(--radius-sm);font-size:11px;">
                    <div>
                      <span style="font-weight:700;color:${isGain ? 'var(--status-online)' : 'var(--fire-300)'};">
                        ${isGain ? `+${tx.pointsDelta}` : tx.pointsDelta} pts
                      </span>
                      <span style="color:var(--text-secondary);margin-left:4px;">(${tx.reason})</span>
                      <div style="color:var(--text-muted);font-size:10px;">${tx.notes || ''}</div>
                    </div>
                    <span style="color:var(--text-muted);font-size:10px;">${dateStr}</span>
                  </div>
                `;
              }).join('') : '<p style="font-size:11px;color:var(--text-muted);">Sin movimientos registrados aún</p>'}
            </div>
          </div>
        </div>
      `;

      // Evento Canjear
      detailWrap.querySelector('#btn-customer-redeem')?.addEventListener('click', async () => {
        const user = store.get('currentUser');
        if (!confirm(`¿Canjear 10 puntos de ${loyalty.fullName} por 1 hamburguesa gratis?`)) return;
        try {
          const res = await customersService.redeem(loyalty.customerId, 1, user.id, 'Canje manual desde panel Clientes');
          toast.success(res.message || '🎉 ¡Hamburguesa gratis canjeada con éxito!');
          await selectCustomer(id);
          await loadCustomers(container.querySelector('#input-customer-search')?.value || '');
        } catch (err) {
          toast.error(`Error al canjear: ${err.message}`);
        }
      });

      // Evento Asignar a Carrito
      detailWrap.querySelector('#btn-use-customer-in-cart')?.addEventListener('click', () => {
        const fullCustomer = currentCustomers.find(c => c.id === loyalty.customerId) || {
          id: loyalty.customerId,
          fullName: loyalty.fullName,
          phone: loyalty.phone,
          loyaltyPoints: loyalty.points,
        };
        store.set({
          cart: {
            ...store.get('cart'),
            customerId: fullCustomer.id,
            customer: fullCustomer,
            deliveryAddress: fullCustomer.address || store.get('cart').deliveryAddress,
          },
        });
        toast.success(`Cliente ${loyalty.fullName} asignado al pedido actual 🔥`);
      });

      // Evento Generar Código Web de Activación
      detailWrap.querySelector('#btn-generate-activation-code')?.addEventListener('click', async () => {
        const btn = detailWrap.querySelector('#btn-generate-activation-code');
        const targetId = loyalty.customerId || id;
        if (btn) {
          btn.disabled = true;
          btn.textContent = '⏳ Generando...';
        }

        try {
          const res = await customersService.generateActivationCode(targetId);
          openCustomerActivationModal({
            customerName: loyalty.fullName,
            phone: loyalty.phone,
            activationCode: res.activationCode,
            expiresAt: res.expiresAt,
          });
        } catch (err) {
          toast.error(err.message || 'Error al generar código de activación');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = '🔑 Generar Código Web';
          }
        }
      });

    } catch (err) {
      detailWrap.innerHTML = `
        <div class="panel empty-state">
          <div class="empty-icon">❌</div>
          <p>Error al cargar detalle: ${err.message}</p>
        </div>`;
    }
  }

  // Modal de Crear Cliente
  container.querySelector('#btn-open-create-customer')?.addEventListener('click', () => {
    openCreateCustomerModal(async (newCustomer) => {
      await loadCustomers();
      await selectCustomer(newCustomer.id);
    });
  });

  // Búsqueda en vivo
  let searchTimeout = null;
  container.querySelector('#input-customer-search')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadCustomers(e.target.value);
    }, 250);
  });

  // Refrescar
  container.querySelector('#btn-refresh-customers')?.addEventListener('click', () => {
    loadCustomers(container.querySelector('#input-customer-search')?.value || '');
  });

  // Carga inicial
  await loadCustomers();
}

function openCreateCustomerModal(onSuccess) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'create-customer-modal-overlay';

  overlay.innerHTML = `
    <div class="modal" style="max-width:440px;">
      <div class="modal-header">
        <h2 class="modal-title">👥 Registrar Nuevo Cliente</h2>
        <button class="btn btn-ghost btn-icon" id="cc-close">✕</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:var(--space-3);">
        <div class="input-group">
          <label class="input-label">Nombre Completo *</label>
          <input class="input" id="cc-name" type="text" placeholder="Ej: Carlos Gómez" required />
        </div>
        <div class="input-group">
          <label class="input-label">Teléfono (WhatsApp) *</label>
          <input class="input" id="cc-phone" type="tel" placeholder="Ej: 3001234567" required />
        </div>
        <div class="input-group">
          <label class="input-label">Email (opcional)</label>
          <input class="input" id="cc-email" type="email" placeholder="cliente@correo.com" />
        </div>
        <div class="input-group">
          <label class="input-label">Dirección (para domicilios)</label>
          <input class="input" id="cc-address" type="text" placeholder="Ej: Calle 45 # 12-34" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cc-cancel">Cancelar</button>
        <button class="btn btn-primary" id="cc-submit">Guardar Cliente</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#cc-close').addEventListener('click', close);
  overlay.querySelector('#cc-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#cc-submit').addEventListener('click', async () => {
    const fullName = overlay.querySelector('#cc-name').value.trim();
    const phone = overlay.querySelector('#cc-phone').value.trim();
    const email = overlay.querySelector('#cc-email').value.trim();
    const address = overlay.querySelector('#cc-address').value.trim();

    if (!fullName || !phone) {
      toast.warning('El nombre y el teléfono son obligatorios');
      return;
    }

    try {
      const created = await customersService.create({
        fullName,
        phone,
        email: email || null,
        address: address || null,
      });
      toast.success(`Cliente ${created.fullName} registrado con éxito`);
      close();
      if (onSuccess) onSuccess(created);
    } catch (err) {
      toast.error(`Error al registrar: ${err.message}`);
    }
  });
}

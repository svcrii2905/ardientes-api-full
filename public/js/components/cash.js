/**
 * cash.js — Vista de gestión de caja registradora
 * Conecta con: /api/v1/cash-registers/sessions
 *
 * Funcionalidades:
 * - Ver sesión activa con métricas detalladas y titularidad
 * - Abrir turno con balance inicial
 * - Cerrar turno con arqueo (restringido al usuario titular)
 * - Registrar depósitos y retiros manuales
 * - Ver historial de transacciones de la sesión
 */
import { cashService } from '../services/cash.service.js';
import { businessDayService } from '../services/businessDay.service.js?v=8';
import { formatCurrency } from '../utils/currency.js';
import { toast } from '../utils/notify.js';
import { store } from '../store/state.js';

export async function renderCash(container) {
  const user = store.get('currentUser') || {};
  const isAdminOrSupervisor = (user.roles || []).some(r => ['ADMIN', 'SUPERVISOR', 'GERENTE'].includes(r.toUpperCase())) ||
    (user.permissions || []).includes('business_day:close');

  container.innerHTML = `
    <div class="page-layout cash-page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">💰 Caja Registradora</h1>
          <p style="color:var(--text-muted);font-size:var(--text-sm);margin-top:2px">
            Gestión de turno, arqueo y movimientos de efectivo
          </p>
        </div>
        <div style="display:flex;gap:var(--space-3);align-items:center">
          ${isAdminOrSupervisor ? `
          <button class="btn btn-danger btn-sm" id="btn-close-business-day" style="min-height:40px">
            🌙 Finalizar Día
          </button>` : ''}
          <button class="btn btn-secondary btn-sm" id="btn-refresh-cash" style="min-height:40px">
            🔄 Actualizar
          </button>
        </div>
      </div>
      <div class="page-body">
        <div id="cash-content">
          <div style="text-align:center;padding:var(--space-10);color:var(--text-muted)">
            <div class="spinner" style="margin:0 auto var(--space-4)"></div>
            Verificando sesión de caja...
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-refresh-cash')?.addEventListener('click', () =>
    refreshCashView(container)
  );

  container.querySelector('#btn-close-business-day')?.addEventListener('click', () =>
    openCloseBusinessDayModal(container)
  );

  await refreshCashView(container);
}

async function refreshCashView(container) {
  const contentEl = container.querySelector('#cash-content');
  if (!contentEl) return;

  contentEl.innerHTML = `
    <div style="text-align:center;padding:var(--space-8);color:var(--text-muted)">
      <div class="spinner" style="margin:0 auto var(--space-3)"></div>
    </div>`;

  try {
    const session = await cashService.getActiveSession({ registerId: 1 });
    store.set({ cashSession: session });

    if (session) {
      await renderOpenSession(contentEl, session, container);
    } else {
      renderOpenSessionForm(contentEl, container);
    }
  } catch (e) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <p>Error al verificar sesión: ${e.message}</p>
        <button class="btn btn-secondary btn-sm" onclick="location.reload()">Reintentar</button>
      </div>`;
  }
}

function renderOpenSessionForm(contentEl, container) {
  contentEl.innerHTML = `
    <div style="max-width:480px;margin:0 auto;width:100%">
      <div class="cash-open-card">
        <div class="cash-open-hero">
          <div style="font-size:3.5rem;margin-bottom:var(--space-3)">🔓</div>
          <h2 style="font-size:var(--text-2xl);font-weight:800;margin-bottom:var(--space-2)">
            Abrir Turno de Caja
          </h2>
          <p style="color:var(--text-muted);font-size:var(--text-sm);line-height:1.6">
            Registra el efectivo inicial del turno para habilitar el procesamiento de pagos.
          </p>
        </div>

        <div class="cash-open-form">
          <div class="input-group">
            <label class="input-label">🏪 Número de Caja</label>
            <input class="input" id="cash-register-id" type="number" value="1" min="1"
                   style="font-size:var(--text-lg);font-weight:600;min-height:48px" />
          </div>

          <div class="input-group">
            <label class="input-label">💵 Saldo Inicial en Efectivo (COP)</label>
            <input class="input" id="cash-opening-balance" type="number"
                   placeholder="50000" min="0"
                   style="font-size:1.75rem;font-weight:800;text-align:right;
                          color:var(--amber-500);letter-spacing:1px;min-height:52px" />
            <span style="font-size:var(--text-xs);color:var(--text-muted)">
              Ingresa el total de billetes y monedas en la gaveta al abrir
            </span>
          </div>

          <div class="input-group">
            <label class="input-label">📝 Notas de apertura (opcional)</label>
            <input class="input" id="cash-notes"
                   placeholder="Ej: Inicio de turno mañana — cajero Juan Pérez"
                   style="min-height:48px" />
          </div>

          <button class="btn btn-primary btn-lg" id="btn-open-session"
                  style="width:100%;margin-top:var(--space-2);min-height:48px">
            🔓 Abrir Caja y Comenzar Turno
          </button>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-open-session')?.addEventListener('click', async () => {
    const registerId     = Number(container.querySelector('#cash-register-id').value) || 1;
    const openingBalance = parseFloat(container.querySelector('#cash-opening-balance').value) || 0;
    const notes          = container.querySelector('#cash-notes').value.trim();

    const btn = container.querySelector('#btn-open-session');
    btn.disabled    = true;
    btn.innerHTML   = '<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;margin-right:8px"></span>Abriendo caja...';

    try {
      const session = await cashService.openSession({ registerId, openingBalance, notes });
      store.set({ cashSession: session });
      toast.success('✅ Caja abierta. ¡Buen turno!');
      await refreshCashView(container.closest('.content-area') || container);
    } catch (e) {
      toast.error('Error al abrir caja: ' + e.message);
      btn.disabled  = false;
      btn.innerHTML = '🔓 Abrir Caja y Comenzar Turno';
    }
  });
}

async function renderOpenSession(contentEl, session, container) {
  const currentUser = store.get('currentUser');
  const openedByName = session.openedByUserName || `Usuario #${session.openedByUserId}`;
  const isOwner = currentUser && Number(currentUser.id) === Number(session.openedByUserId);

  const openedAt = session.openedAt
    ? new Date(session.openedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  // Cargar transacciones
  let transactions = [];
  try {
    transactions = await cashService.listTransactions(session.id);
  } catch {
    // no crítico si falla
  }

  const totals = session.totals || {
    totalDeposits: transactions.filter(t => t.transactionType === 'DEPOSIT').reduce((s, t) => s + Number(t.amount), 0),
    totalWithdrawals: transactions.filter(t => t.transactionType === 'WITHDRAWAL').reduce((s, t) => s + Number(t.amount), 0),
    totalOrderPaymentsCash: 0,
    totalOrderPaymentsCard: 0,
    totalOrderPaymentsDigital: 0,
    totalExpectedCash: session.openingBalance
  };

  const salesCash = totals.totalOrderPaymentsCash;
  const salesOther = totals.totalOrderPaymentsCard + totals.totalOrderPaymentsDigital;

  contentEl.innerHTML = `
    <div class="cash-session-layout">

      <!-- ── Fila superior: métricas ── -->
      <div class="cash-metrics-row">
        <div class="cash-metric-card">
          <span class="cash-metric-label">💰 Saldo Inicial</span>
          <span class="cash-metric-value">${formatCurrency(session.openingBalance)}</span>
        </div>
        <div class="cash-metric-card">
          <span class="cash-metric-label">💵 Ventas (Efectivo)</span>
          <span class="cash-metric-value green">+${formatCurrency(salesCash)}</span>
        </div>
        <div class="cash-metric-card">
          <span class="cash-metric-label">💳 Ventas (Otros)</span>
          <span class="cash-metric-value" style="color:var(--text-secondary)">${formatCurrency(salesOther)}</span>
        </div>
        <div class="cash-metric-card cash-metric-accent">
          <span class="cash-metric-label">⬆️ Depósitos</span>
          <span class="cash-metric-value green">+${formatCurrency(totals.totalDeposits)}</span>
        </div>
        <div class="cash-metric-card">
          <span class="cash-metric-label">⬇️ Retiros</span>
          <span class="cash-metric-value red">-${formatCurrency(totals.totalWithdrawals)}</span>
        </div>
        <div class="cash-metric-card cash-metric-highlight">
          <span class="cash-metric-label">⚖️ Efectivo Esperado</span>
          <span class="cash-metric-value">${formatCurrency(totals.totalExpectedCash)}</span>
        </div>
      </div>

      <!-- ── Fila principal: info + cierre + movimientos ── -->
      <div class="cash-main-grid">

        <!-- Info de la sesión -->
        <div class="panel cash-info-panel">
          <div class="cash-panel-title">
            <span class="cash-status-badge">● ABIERTA</span>
            <h3>Sesión Activa</h3>
          </div>
          <div class="cash-info-list">
            ${[
              ['Sesión #',   session.id],
              ['Caja #',     session.registerId],
              ['Apertura',   openedAt],
              ['Abierta por', openedByName],
            ].map(([lbl, val]) => `
              <div class="cash-info-row">
                <span class="cash-info-label">${lbl}</span>
                <span class="cash-info-value">${val}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Arqueo y cierre -->
        <div class="panel">
          <h3 style="font-size:var(--text-base);font-weight:700;
                     margin-bottom:var(--space-4);color:var(--text-primary)">
            🔒 Cerrar Turno — Arqueo
          </h3>

          ${isOwner ? `
            <p style="color:var(--text-muted);font-size:var(--text-sm);
                      margin-bottom:var(--space-4);line-height:1.5">
              Cuenta el efectivo en la gaveta e ingresa el total físico contado.
              El sistema calculará la discrepancia automáticamente.
            </p>

            <div class="input-group" style="margin-bottom:var(--space-3)">
              <label class="input-label">💵 Efectivo contado (COP)</label>
              <input class="input" id="cash-closing-balance" type="number"
                     placeholder="0" min="0"
                     style="font-size:1.75rem;font-weight:800;text-align:right;
                            color:var(--amber-500);min-height:50px" />
            </div>

            <div class="input-group" style="margin-bottom:var(--space-5)">
              <label class="input-label">📝 Notas de descuadre (si aplica)</label>
              <input class="input" id="cash-discrepancy-notes"
                     placeholder="Ej: Faltaron $2.000 en billetes"
                     style="min-height:46px" />
            </div>

            <button class="btn btn-danger" id="btn-close-session" style="width:100%;min-height:48px">
              🔒 Cerrar Caja y Archivar Turno
            </button>
          ` : `
            <div class="cash-ownership-warning" style="padding:var(--space-4);background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius-lg)">
              <div style="font-size:1.5rem;margin-bottom:var(--space-2)">⚠️</div>
              <h4 style="font-size:var(--text-base);font-weight:700;color:#EF4444;margin-bottom:var(--space-2)">
                Cierre Restringido
              </h4>
              <p style="color:var(--text-secondary);font-size:var(--text-sm);line-height:1.5">
                Esta sesión fue abierta por <strong>${openedByName}</strong>. Únicamente este usuario puede realizar el cierre del turno.
              </p>
            </div>
          `}
        </div>

        <!-- Movimientos de efectivo -->
        <div class="panel" style="grid-column:1/-1">
          <div style="display:flex;justify-content:space-between;align-items:center;
                      margin-bottom:var(--space-4);flex-wrap:wrap;gap:var(--space-2)">
            <h3 style="font-size:var(--text-base);font-weight:700">
              📋 Movimientos del Turno (${transactions.length})
            </h3>
            <button class="btn btn-primary btn-sm" id="btn-add-transaction" style="min-height:40px">
              + Nuevo Movimiento
            </button>
          </div>

          <!-- Formulario de movimiento (oculto por defecto) -->
          <div id="transaction-form" class="hidden cash-txn-form">
            <div class="input-group">
              <label class="input-label">Tipo</label>
              <select class="input" id="txn-type" style="min-height:46px">
                <option value="DEPOSIT">💵 Depósito</option>
                <option value="WITHDRAWAL">📤 Retiro</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Monto (COP)</label>
              <input class="input" id="txn-amount" type="number"
                     placeholder="0" min="1" style="min-height:46px" />
            </div>
            <div class="input-group cash-txn-notes-group">
              <label class="input-label">Descripción (obligatoria)</label>
              <input class="input" id="txn-notes"
                     placeholder="Ej: Pago de domicilio en efectivo" style="min-height:46px" />
            </div>
            <div class="cash-txn-btn-group">
              <button class="btn btn-primary" id="btn-save-txn" style="min-height:46px;flex:1">Guardar</button>
              <button class="btn btn-ghost" id="btn-cancel-txn" style="min-height:46px">Cancelar</button>
            </div>
          </div>

          <!-- Listado de transacciones -->
          ${transactions.length
            ? renderTransactionsList(transactions)
            : `<div class="empty-state" style="padding:var(--space-8)">
                <div class="empty-icon">📋</div>
                <p>Sin movimientos registrados en este turno</p>
               </div>`
          }
        </div>

      </div><!-- /cash-main-grid -->
    </div><!-- /cash-session-layout -->
  `;

  // ── Cerrar sesión ──────────────────────────────────────────────────
  if (isOwner) {
    contentEl.querySelector('#btn-close-session')?.addEventListener('click', async () => {
      const closingBalanceReal = parseFloat(contentEl.querySelector('#cash-closing-balance').value);
      if (isNaN(closingBalanceReal) || closingBalanceReal < 0) {
        toast.warning('⚠️ Ingresa el efectivo físico contado en la gaveta');
        contentEl.querySelector('#cash-closing-balance').focus();
        return;
      }
      if (!confirm(`¿Confirmas cerrar el turno con $${closingBalanceReal.toLocaleString('es-CO')} COP contados?`)) return;

      const notes  = contentEl.querySelector('#cash-discrepancy-notes').value.trim();
      const btn    = contentEl.querySelector('#btn-close-session');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:8px"></span>Cerrando...';

      try {
        await cashService.closeSession(session.id, { closingBalanceReal, discrepancyNotes: notes });
        toast.success('✅ Turno de caja cerrado exitosamente');
        store.set({ cashSession: null });
        await refreshCashView(container);
      } catch (e) {
        toast.error(e.message || 'Error al cerrar caja');
        btn.disabled  = false;
        btn.innerHTML = '🔒 Cerrar Caja y Archivar Turno';
      }
    });
  }

  // ── Toggle formulario de transacción ──────────────────────────────
  contentEl.querySelector('#btn-add-transaction')?.addEventListener('click', () => {
    const form = contentEl.querySelector('#transaction-form');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      contentEl.querySelector('#txn-amount')?.focus();
    }
  });

  contentEl.querySelector('#btn-cancel-txn')?.addEventListener('click', () => {
    contentEl.querySelector('#transaction-form').classList.add('hidden');
  });

  // ── Guardar transacción ────────────────────────────────────────────
  contentEl.querySelector('#btn-save-txn')?.addEventListener('click', async () => {
    const type   = contentEl.querySelector('#txn-type').value;
    const amount = parseFloat(contentEl.querySelector('#txn-amount').value);
    const notes  = contentEl.querySelector('#txn-notes').value.trim();
    const user   = store.get('currentUser');

    if (!amount || amount <= 0) { toast.warning('⚠️ Ingresa un monto mayor a $0'); return; }
    if (!notes)                  { toast.warning('⚠️ La descripción del movimiento es obligatoria'); return; }

    const btn = contentEl.querySelector('#btn-save-txn');
    btn.disabled  = true;
    btn.textContent = 'Guardando...';

    try {
      await cashService.createTransaction(session.id, {
        transactionType: type,
        amount,
        performedBy: user?.id,
        notes,
      });
      toast.success(`✅ ${type === 'DEPOSIT' ? 'Depósito' : 'Retiro'} de ${formatCurrency(amount)} registrado`);
      await renderOpenSession(contentEl, session, container);
    } catch (e) {
      toast.error(e.message || 'Error al guardar movimiento');
      btn.disabled  = false;
      btn.textContent = 'Guardar';
    }
  });
}

function renderTransactionsList(transactions) {
  return `
    <div class="cash-transactions-wrapper">
      <!-- Vista Tabla Desktop -->
      <div class="cash-table-desktop">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tipo</th>
              <th>Monto</th>
              <th>Descripción</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(t => {
              const isDeposit = t.transactionType === 'DEPOSIT';
              const date = t.createdAt
                ? new Date(t.createdAt).toLocaleString('es-CO', { timeStyle: 'short', dateStyle: 'short' })
                : '—';
              return `
                <tr>
                  <td style="color:var(--text-muted)">#${t.id}</td>
                  <td>
                    <span class="badge ${isDeposit ? 'badge-green' : 'badge-red'}">
                      ${isDeposit ? '⬆️ Depósito' : '⬇️ Retiro'}
                    </span>
                  </td>
                  <td>
                    <strong style="color:${isDeposit ? 'var(--status-online)' : '#EF4444'}">
                      ${isDeposit ? '+' : '-'}${formatCurrency(t.amount)}
                    </strong>
                  </td>
                  <td style="color:var(--text-secondary);font-size:var(--text-sm)">
                    ${t.notes || '—'}
                  </td>
                  <td style="color:var(--text-muted);font-size:var(--text-xs)">${date}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Vista Tarjetas Móvil -->
      <div class="cash-cards-mobile">
        ${transactions.map(t => {
          const isDeposit = t.transactionType === 'DEPOSIT';
          const date = t.createdAt
            ? new Date(t.createdAt).toLocaleString('es-CO', { timeStyle: 'short', dateStyle: 'short' })
            : '—';
          return `
            <div class="cash-txn-card">
              <div class="cash-txn-card-header">
                <span class="badge ${isDeposit ? 'badge-green' : 'badge-red'}">
                  ${isDeposit ? '⬆️ Depósito' : '⬇️ Retiro'}
                </span>
                <strong style="color:${isDeposit ? 'var(--status-online)' : '#EF4444'};font-size:var(--text-base)">
                  ${isDeposit ? '+' : '-'}${formatCurrency(t.amount)}
                </strong>
              </div>
              <div class="cash-txn-card-body">
                <p class="cash-txn-card-notes">${t.notes || 'Sin descripción'}</p>
                <div class="cash-txn-card-footer">
                  <span>#${t.id}</span>
                  <span>${date}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

async function openCloseBusinessDayModal(container) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modal-close-business-day";

  overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <div>
          <h2 class="modal-title">🌙 Finalizar Jornada Operativa</h2>
          <span style="font-size:var(--text-xs);color:var(--text-muted)">Cierre diario del restaurante</span>
        </div>
        <button class="btn btn-ghost btn-icon" id="cbd-close">✕</button>
      </div>

      <div class="modal-body" id="cbd-body">
        <div style="text-align:center;padding:var(--space-6);color:var(--text-muted)">
          <div class="spinner" style="margin:0 auto var(--space-3)"></div>
          Consultando estado de la jornada...
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#cbd-close")?.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  try {
    const res = await businessDayService.getSummary();
    const summary = res.data;

    const hasOpenCash = summary.openCashSessionsCount > 0;
    const hasPendingOrders = summary.pendingOrdersCount > 0;
    const isClosed = summary.isClosed;
    const hasBlockers = hasOpenCash || hasPendingOrders || isClosed;

    let blockerAlertsHtml = "";
    if (isClosed) {
      blockerAlertsHtml += `
        <div style="padding:12px;background:rgba(239,68,68,0.1);border:1px solid #EF4444;border-radius:8px;color:#EF4444;font-size:13px;font-weight:600;">
          ⚠️ La jornada del día (${summary.businessDate}) ya fue finalizada previamente.
        </div>`;
    }

    if (hasOpenCash) {
      const details = summary.openCashSessionsDetails
        .map(d => `<b>Caja #${d.registerId}</b> abierta por <b>${d.openedByUserName}</b>`)
        .join("<br>");
      blockerAlertsHtml += `
        <div style="padding:12px;background:rgba(245,158,11,0.1);border:1px solid #F59E0B;border-radius:8px;color:#D97706;font-size:13px;">
          ⚠️ <b>Cajas Abiertas (${summary.openCashSessionsCount}):</b><br>
          ${details}<br>
          <small style="color:var(--text-muted)">Cada titular debe realizar el arqueo y cierre de su caja antes de finalizar el día.</small>
        </div>`;
    }

    if (hasPendingOrders) {
      const details = summary.pendingOrdersDetails
        .slice(0, 5)
        .map(o => `<b>${o.displayOrderNumber}</b> (${o.status}${o.tableId ? ` - Mesa ${o.tableId}` : ''})`)
        .join("<br>");
      blockerAlertsHtml += `
        <div style="padding:12px;background:rgba(245,158,11,0.1);border:1px solid #F59E0B;border-radius:8px;color:#D97706;font-size:13px;margin-top:8px;">
          ⚠️ <b>Pedidos Pendientes (${summary.pendingOrdersCount}):</b><br>
          ${details}<br>
          <small style="color:var(--text-muted)">Cobra o atiende los pedidos antes de cerrar la jornada.</small>
        </div>`;
    }

    const bodyEl = overlay.querySelector("#cbd-body");
    bodyEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        ${blockerAlertsHtml}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);background:var(--bg-card);padding:var(--space-4);border-radius:var(--radius-md);">
          <div>
            <span style="font-size:var(--text-xs);color:var(--text-muted);display:block">Ventas cobradas</span>
            <strong style="font-size:1.2rem;color:var(--status-online)">${formatCurrency(summary.totalSalesAmount)}</strong>
          </div>
          <div>
            <span style="font-size:var(--text-xs);color:var(--text-muted);display:block">Pedidos cobrados</span>
            <strong style="font-size:1.2rem">${summary.totalOrdersCount}</strong>
          </div>
          <div>
            <span style="font-size:var(--text-xs);color:var(--text-muted);display:block">Mesas ocupadas</span>
            <strong style="font-size:1.1rem;color:${summary.occupiedTablesCount > 0 ? 'var(--amber-500)' : 'var(--status-online)'}">${summary.occupiedTablesCount}/7</strong>
          </div>
          <div>
            <span style="font-size:var(--text-xs);color:var(--text-muted);display:block">Cajas abiertas</span>
            <strong style="font-size:1.1rem;color:${hasOpenCash ? '#EF4444' : 'var(--status-online)'}">${summary.openCashSessionsCount}</strong>
          </div>
        </div>

        <p style="font-size:var(--text-sm);color:var(--text-secondary);margin:0">
          ¿Deseas finalizar la jornada del <b>${summary.businessDate}</b>?
        </p>

        <div style="display:flex;gap:var(--space-3);margin-top:var(--space-2)">
          <button class="btn btn-secondary" id="cbd-cancel" style="flex:1">CANCELAR</button>
          <button class="btn btn-danger" id="cbd-confirm" style="flex:1" ${hasBlockers ? 'disabled' : ''}>
            🌙 FINALIZAR DÍA
          </button>
        </div>
      </div>
    `;

    bodyEl.querySelector("#cbd-cancel")?.addEventListener("click", close);
    bodyEl.querySelector("#cbd-confirm")?.addEventListener("click", async () => {
      const confirmBtn = bodyEl.querySelector("#cbd-confirm");
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Finalizando...";

      try {
        await businessDayService.closeBusinessDay();
        toast.success(`🌙 Jornada del ${summary.businessDate} finalizada exitosamente. Mesas liberadas.`);
        close();
        refreshCashView(container);
      } catch (err) {
        toast.error(`Error al finalizar jornada: ${err.message}`);
        confirmBtn.disabled = false;
        confirmBtn.textContent = "🌙 FINALIZAR DÍA";
      }
    });

  } catch (err) {
    overlay.querySelector("#cbd-body").innerHTML = `
      <div style="padding:16px;color:#EF4444">
        Error al obtener resumen de la jornada: ${err.message}
      </div>`;
  }
}


/**
 * paymentModal.js — Modal de cobro con selección de método de pago
 * Conecta con: POST /api/v1/orders y POST /api/v1/payments
 *
 * FIX: Se agrega sessionId obligatorio desde el store (cashSession).
 *      Si no hay sesión de caja activa, se bloquea el cobro y se
 *      informa al cajero que debe abrir la caja primero.
 */
import { store, clearCart } from '../store/state.js';
import { ordersService } from '../services/orders.service.js';
import { paymentsService } from '../services/payments.service.js';
import { formatCurrency, calcChange } from '../utils/currency.js';
import { toast } from '../utils/notify.js';
import { CONFIG } from '../config.js';

let selectedMethodId   = null;
let selectedMethodType = null;
let amountPaid = 0;
export async function openPaymentModal(order, cartSnapshot) {
  // Evitar instancias duplicadas apiladas si ya existe un modal de pago en pantalla
  if (document.getElementById('payment-modal-overlay')) {
    console.warn('openPaymentModal: Ya existe un modal de pago abierto en el DOM.');
    return { success: false, reason: 'already_open' };
  }

  return new Promise(async (resolve) => {
    // Si mientras se resolvía algo asíncrono se creó uno, doble check
    if (document.getElementById('payment-modal-overlay')) {
      resolve({ success: false, reason: 'already_open' });
      return;
    }

    let isProcessing = false;
    selectedMethodId   = null;
    selectedMethodType = null;
    amountPaid         = 0;

    // ── Verificar sesión de caja activa ──────────────────────────────
    const cashSession = store.get('cashSession');
    if (!cashSession || !cashSession.id) {
      toast.error('⚠️ No hay sesión de caja activa. Abre la caja en la sección 💰 Caja antes de cobrar.');
      resolve({ success: false, reason: 'no_cash_session' });
      return;
    }

    // ── Cargar métodos de pago ────────────────────────────────────────
    let paymentMethods = store.get('paymentMethods');
    if (!paymentMethods || !paymentMethods.length) {
      try {
        paymentMethods = await paymentsService.getPaymentMethods();
        store.set({ paymentMethods });
      } catch {
        toast.error('No se pudieron cargar los métodos de pago');
        resolve({ success: false, reason: 'error_loading_methods' });
        return;
      }
    }

    let totalPaidSoFar = 0;
    let pendingBalance = order.total;

    if (order.id) {
      try {
        const summary = await paymentsService.getOrderPayments(order.id);
        if (summary) {
          totalPaidSoFar = summary.totalPaid || 0;
          pendingBalance = summary.pendingBalance !== undefined ? summary.pendingBalance : order.total;
          if (summary.isFullyPaid || pendingBalance <= 0) {
            const displayLabel = order.dailyOrderNumber ? `PEDIDO ${order.dailyOrderNumber}` : `Pedido #${order.orderNumber}`;
            toast.info(`El ${displayLabel} ya está totalmente pagado.`);
            resolve({ success: false, reason: 'already_paid' });
            return;
          }
        }
      } catch (e) {
        console.warn("No se pudo obtener el saldo pendiente de la orden", e);
      }
    }

    const total = pendingBalance;

    // Usa cartSnapshot o construye uno básico desde order
    const cart = cartSnapshot || {
      subtotal: order.subtotal,
      disposableFee: order.disposableFee,
      orderType: order.orderType,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount,
      customer: order.customerId ? { fullName: 'Cliente #' + order.customerId, phone: '' } : null,
      tableId: order.tableId,
      items: [],
    };

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'payment-modal-overlay';

    const orderTitleLabel = order.dailyOrderNumber ? `PEDIDO ${order.dailyOrderNumber}` : (order.orderNumber ? `Pedido #${order.orderNumber}` : 'NUEVO');

  overlay.innerHTML = `
    <div class="modal payment-modal" style="max-width:540px">
      <div class="modal-header">
        <div style="display:flex;flex-direction:column;gap:4px">
          <h2 class="modal-title">💳 Procesar Cobro</h2>
          <span style="font-size:var(--text-xs);color:var(--text-muted)">
            Sesión de caja #${cashSession.id} · Caja #${cashSession.registerId}
          </span>
          <span style="font-size:var(--text-xs);color:var(--text-secondary)">${orderTitleLabel}</span>
        </div>
        <button class="btn btn-ghost btn-icon" id="pm-close">✕</button>
      </div>

      <div class="modal-body" style="display:flex;flex-direction:column;gap:var(--space-5)">

        <!-- Resumen del pedido -->
        <div class="payment-summary-card">
          <div class="payment-summary-row">
            <span>Subtotal</span>
            <span>${formatCurrency(cart.subtotal)}</span>
          </div>
          ${cart.disposableFee > 0 ? `
          <div class="payment-summary-row" style="color:var(--amber-400)">
            <span>Desechables (${cart.orderType === 'DOMICILIO' ? 'Domicilio' : 'Para llevar'})</span>
            <span>+${formatCurrency(cart.disposableFee)}</span>
          </div>` : ''}
          <div class="payment-summary-row">
            <span>Impoconsumo (8%)</span>
            <span>${formatCurrency(cart.taxAmount)}</span>
          </div>
          ${cart.discountAmount > 0 ? `
          <div class="payment-summary-row" style="color:var(--status-online)">
            <span>Descuento</span>
            <span>-${formatCurrency(cart.discountAmount)}</span>
          </div>` : ''}
          
          <div class="payment-summary-row" style="border-top: 1px dashed var(--border-medium); padding-top: var(--space-2); margin-top: var(--space-2);">
            <span>Total de la orden:</span>
            <span>${formatCurrency(order.total)}</span>
          </div>
          ${totalPaidSoFar > 0 ? `
          <div class="payment-summary-row" style="color:var(--emerald-400); font-weight:700;">
            <span>Pagado:</span>
            <span>-${formatCurrency(totalPaidSoFar)}</span>
          </div>` : ''}

          <div class="payment-total-card" style="margin-top:var(--space-2)">
            <span>SALDO PENDIENTE</span>
            <span class="payment-total-amount">${formatCurrency(total)}</span>
          </div>
        </div>

        <!-- Cliente identificado (si existe) -->
        ${cart.customer ? `
        <div style="display:flex;align-items:center;gap:var(--space-3);
                    padding:var(--space-2) var(--space-4);
                    background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.25);border-radius:var(--radius-md)">
          <span style="font-size:var(--text-sm);font-weight:700;color:var(--amber-400);">👤 Cliente:</span>
          <span style="font-size:var(--text-sm);font-weight:600;">${cart.customer.fullName} · 📞 ${cart.customer.phone}</span>
          <span style="margin-left:auto;font-size:var(--text-xs);color:var(--fire-300);font-weight:700;">🔥 ${cart.customer.loyaltyPoints ?? 0} pts</span>
        </div>` : ''}

        <!-- Tipo de pedido + mesa (solo lectura en cobro) -->
        <div style="display:flex;align-items:center;gap:var(--space-3);
                    padding:var(--space-3) var(--space-4);
                    background:var(--bg-card);border-radius:var(--radius-md)">
          <span style="color:var(--text-muted);font-size:var(--text-sm)">Tipo de pedido:</span>
          <span style="font-weight:600;font-size:var(--text-sm)">
            ${CONFIG.ORDER_TYPES.find(t => t.value === cart.orderType)?.icon || ''}
            ${CONFIG.ORDER_TYPES.find(t => t.value === cart.orderType)?.label || cart.orderType}
            ${cart.orderType === 'MESA' && cart.tableId ? ` · Mesa ${cart.tableId}` : ''}
          </span>
          <span style="margin-left:auto;font-size:var(--text-xs);color:var(--text-muted)">
            ${cart.items.length} ítem${cart.items.length !== 1 ? 's' : ''}
          </span>
        </div>

        <!-- Métodos de pago -->
        <div>
          <p style="font-size:var(--text-sm);font-weight:600;color:var(--text-secondary);
                    margin-bottom:var(--space-3)">Selecciona el método de pago</p>
          <div class="payment-methods-grid" id="pm-methods">
            ${paymentMethods.map(m => {
              const icon = CONFIG.PAYMENT_METHOD_ICONS[m.type] || '💰';
              return `
                <button class="payment-method-card" data-id="${m.id}"
                        data-type="${m.type}" data-requires-ref="${m.requiresReference}">
                  <span class="pm-icon">${icon}</span>
                  <span class="pm-name">${m.name}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Sección efectivo (solo si método = CASH/EFECTIVO) -->
        <div id="pm-cash-section" class="hidden">
          <div class="input-group">
            <label class="input-label">💵 Efectivo recibido del cliente</label>
            <input class="input pm-amount-input" id="pm-cash-received" type="number"
                   min="0" placeholder="0"
                   style="font-size:1.75rem;font-weight:800;text-align:right;
                          letter-spacing:1px;color:var(--amber-500)" />
          </div>

          <!-- Teclas rápidas -->
          <div class="pm-quick-grid" style="margin-top:var(--space-3)">
            ${[5000,10000,20000,50000,100000].map(v => `
              <button class="pm-quick-btn" data-amount="${v}">
                ${formatCurrency(v)}
              </button>`).join('')}
          </div>

          <!-- Cambio calculado -->
          <div class="change-display" id="change-display">
            <span class="change-label">Cambio / Devuelta</span>
            <span class="change-amount" id="pm-change">${formatCurrency(0)}</span>
          </div>
        </div>

        <!-- Referencia de transacción (para Nequi, Daviplata, Tarjeta, etc.) -->
        <div id="pm-ref-section" class="hidden">
          <div class="input-group">
            <label class="input-label">🔢 Referencia / Número de transacción</label>
            <input class="input" id="pm-ref" type="text"
                   placeholder="Ej: 123456789" autocomplete="off" />
            <span style="font-size:var(--text-xs);color:var(--text-muted)">
              Requerido para este método de pago
            </span>
          </div>
        </div>

      </div><!-- /modal-body -->

      <div class="modal-footer">
        <button class="btn btn-secondary" id="pm-cancel">Cancelar</button>
        <button class="btn btn-checkout" id="pm-confirm" disabled
                style="flex:1;padding:var(--space-4);font-size:var(--text-lg)">
          ✅ Confirmar Pago
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // ── Eventos del modal ──────────────────────────────────────────────

  const close = () => {
    if (isProcessing) return; // No cerrar mientras la petición HTTP está en vuelo
    overlay.remove();
    selectedMethodId   = null;
    selectedMethodType = null;
    amountPaid         = 0;
    resolve({ success: false, reason: 'cancelled' });
  };
  overlay.querySelector('#pm-close').addEventListener('click', close);
  overlay.querySelector('#pm-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // Selección de método de pago
  overlay.querySelector('#pm-methods').addEventListener('click', e => {
    if (isProcessing) return;
    const btn = e.target.closest('.payment-method-card');
    if (!btn) return;

    overlay.querySelectorAll('.payment-method-card').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedMethodId   = Number(btn.dataset.id);
    selectedMethodType = btn.dataset.type;
    const needsRef     = btn.dataset.requiresRef === 'true';
    const isCash       = selectedMethodType === 'EFECTIVO' || selectedMethodType === 'CASH';

    overlay.querySelector('#pm-cash-section').classList.toggle('hidden', !isCash);
    overlay.querySelector('#pm-ref-section').classList.toggle('hidden', !needsRef);

    if (isCash) {
      amountPaid = total;
      overlay.querySelector('#pm-cash-received').value = '';
      overlay.querySelector('#pm-cash-received').focus();
      updateChange(overlay, 0, total);
      overlay.querySelector('#pm-confirm').disabled = true;
    } else {
      amountPaid = total;
      overlay.querySelector('#pm-confirm').disabled = needsRef; // habilitar solo si no requiere ref
      if (!needsRef) overlay.querySelector('#pm-confirm').disabled = false;
    }
  });

  // Efectivo recibido
  overlay.querySelector('#pm-cash-received').addEventListener('input', e => {
    if (isProcessing) return;
    amountPaid = parseFloat(e.target.value) || 0;
    updateChange(overlay, amountPaid, total);
    overlay.querySelector('#pm-confirm').disabled = amountPaid < total;
  });

  // Referencia de transacción
  overlay.querySelector('#pm-ref').addEventListener('input', e => {
    if (isProcessing) return;
    const hasRef = e.target.value.trim().length > 0;
    if (selectedMethodId && selectedMethodType !== 'EFECTIVO' && selectedMethodType !== 'CASH') {
      overlay.querySelector('#pm-confirm').disabled = !hasRef;
    }
  });

  // Teclas rápidas de efectivo
  overlay.querySelectorAll('.pm-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isProcessing) return;
      const v = parseFloat(btn.dataset.amount);
      const input = overlay.querySelector('#pm-cash-received');
      amountPaid  = v;
      input.value = v;
      updateChange(overlay, v, total);
      overlay.querySelector('#pm-confirm').disabled = v < total;
    });
  });

  // Confirmar pago
  overlay.querySelector('#pm-confirm').addEventListener('click', async () => {
    if (isProcessing) return;
    if (!selectedMethodId) {
      toast.error('Selecciona un método de pago');
      return;
    }
    if ((selectedMethodType === 'CASH' || selectedMethodType === 'EFECTIVO') && amountPaid < total) {
      toast.error('El monto ingresado es insuficiente');
      return;
    }
    isProcessing = true;
    await processCheckout(overlay, order, total, cashSession, cartSnapshot, resolve, () => {
      isProcessing = false;
    });
  });
  });
}

function updateChange(overlay, paid, total) {
  const change = calcChange(paid, total);
  const el     = overlay.querySelector('#pm-change');
  if (!el) return;
  el.textContent = formatCurrency(change);
  el.style.color = change > 0 ? 'var(--status-online)' : 'var(--text-muted)';
}

async function processCheckout(overlay, order, total, cashSession, receiptCartSnapshot, resolvePromise, onFinally) {
  const confirmBtn = overlay.querySelector('#pm-confirm');
  confirmBtn.disabled  = true;
  confirmBtn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;margin-right:8px"></span>Procesando...';

  try {
    const user = store.get('currentUser');

    // Registrar el pago — incluye sessionId de la sesión de caja activa
    const reference = overlay.querySelector('#pm-ref')?.value?.trim() || null;
    const paymentDTO = {
      orderId:              order.id,
      paymentMethodId:      selectedMethodId,
      sessionId:            cashSession.id,
      amount:               total,
      changeAmount:         calcChange(amountPaid, total),
      transactionReference: reference,
      performedBy:          user.id,
    };

    const paymentResult = await paymentsService.processPayment(paymentDTO);

    order.paidAt = new Date().toISOString();
    const displayLabel = order.dailyOrderNumber ? `PEDIDO ${order.dailyOrderNumber}` : `Pedido #${order.orderNumber}`;
    toast.success(`✅ Pago registrado para ${displayLabel} — ${formatCurrency(total)}`);
    store.set({ lastOrder: order });
    
    // Si viene desde el carrito, lo limpiamos
    if (receiptCartSnapshot) {
      clearCart();
    }
    overlay.remove();

    // Notificar globalmente que el pago fue completado
    globalThis.dispatchEvent(new CustomEvent('payment:completed', { 
      detail: { orderId: order.id, tableId: order.tableId, payment: paymentResult } 
    }));

    // Construir un snapshot simple si no hay uno (cobro desde vista de mesas/órdenes)
    const snapshot = receiptCartSnapshot || {
      orderType: order.orderType,
      items: [], beverages: [], combos: [],
      tableId: order.tableId, customerId: order.customerId
    };

    // Mostrar modal del recibo
    showReceiptModal(order, snapshot, total, selectedMethodType, resolvePromise);

  } catch (err) {
    const errMsg = (err?.message || '').toLowerCase();
    const isAlreadyPaid = errMsg.includes('ya está pagada') || 
                          errMsg.includes('ya esta pagada') || 
                          errMsg.includes('already_paid') ||
                          errMsg.includes('totalmente pagado');

    if (isAlreadyPaid) {
      toast.info('El pedido ya se encuentra pagado.');
      order.paidAt = order.paidAt || new Date().toISOString();
      overlay.remove();
      selectedMethodId   = null;
      selectedMethodType = null;
      amountPaid         = 0;

      // Actualizar la interfaz mediante el evento global existente
      globalThis.dispatchEvent(new CustomEvent('payment:completed', { 
        detail: { orderId: order.id, tableId: order.tableId, alreadyPaid: true } 
      }));

      if (typeof resolvePromise === 'function') {
        resolvePromise({ success: true, alreadyPaid: true, orderId: order.id });
      }
      return;
    }

    toast.error(`Error al procesar: ${err.message}`);
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = '✅ Confirmar Pago';
    if (typeof onFinally === 'function') onFinally();
  }
}

function showReceiptModal(order, cartSnapshot, total, methodType, resolvePromise) {
  const receiptOverlay = document.createElement('div');
  receiptOverlay.className = 'modal-overlay';
  receiptOverlay.id = 'receipt-modal-overlay';

  const customer = cartSnapshot.customer;
  const nowStr = new Date().toLocaleString('es-CO');
  const receiptOrderHeader = order.dailyOrderNumber ? `PEDIDO ${order.dailyOrderNumber}` : `Pedido: #${order.orderNumber}`;

  receiptOverlay.innerHTML = `
    <div class="modal receipt-modal" style="max-width:400px;font-family:monospace;background:#fff;color:#111;padding:var(--space-6);border-radius:var(--radius-lg);">
      <div style="text-align:center;border-bottom:1px dashed #444;padding-bottom:10px;margin-bottom:10px;">
        <h2 style="font-size:1.4rem;font-weight:900;margin:0;letter-spacing:1px;color:#d9381e;">🔥 ARDIENTES</h2>
        <p style="font-size:11px;margin:2px 0 0 0;color:#555;">Comprobante de Venta</p>
        <p style="font-size:11px;margin:2px 0 0 0;font-weight:700;">${receiptOrderHeader}</p>
        <p style="font-size:10px;margin:2px 0 0 0;color:#777;">${nowStr}</p>
      </div>

      <div style="font-size:11px;border-bottom:1px dashed #444;padding-bottom:8px;margin-bottom:8px;">
        <div><b>Tipo:</b> ${cartSnapshot.orderType}${cartSnapshot.tableId ? ` (Mesa ${cartSnapshot.tableId})` : ''}</div>
        ${customer ? `<div><b>Cliente:</b> ${customer.fullName} · 📞 ${customer.phone}</div>` : ''}
        ${cartSnapshot.deliveryAddress ? `<div><b>Dirección:</b> ${cartSnapshot.deliveryAddress}</div>` : ''}
      </div>

      <!-- Detalle de productos -->
      <div style="font-size:11px;display:flex;flex-direction:column;gap:6px;border-bottom:1px dashed #444;padding-bottom:8px;margin-bottom:8px;">
        ${cartSnapshot.items.map(item => `
          <div style="display:flex;justify-content:space-between;">
            <div>
              <span>${item.qty}x ${item.name}</span>
              ${item.toppings && item.toppings.length ? `
                <div style="font-size:9px;color:#555;padding-left:8px;">
                  ${item.toppings.map(t => `+ ${t.toppingName}`).join(', ')}
                </div>` : ''}
            </div>
            <span style="font-weight:700;">${formatCurrency(item.lineTotal)}</span>
          </div>
        `).join('')}
        ${cartSnapshot.beverages.map(bev => `
          <div style="display:flex;justify-content:space-between;">
            <span>${bev.qty}x ${bev.name}</span>
            <span style="font-weight:700;">${formatCurrency(bev.lineTotal)}</span>
          </div>
        `).join('')}
        ${cartSnapshot.combos.map(combo => `
          <div style="display:flex;justify-content:space-between;">
            <span>${combo.qty}x Combo: ${combo.name}</span>
            <span style="font-weight:700;">${formatCurrency(combo.lineTotal)}</span>
          </div>
        `).join('')}
      </div>

      <!-- Subtotales y Desechables -->
      <div style="font-size:11px;display:flex;flex-direction:column;gap:3px;border-bottom:1px dashed #444;padding-bottom:8px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;">
          <span>Subtotal:</span>
          <span>${formatCurrency(cartSnapshot.subtotal)}</span>
        </div>
        ${cartSnapshot.disposableFee > 0 ? `
        <div style="display:flex;justify-content:space-between;font-weight:700;">
          <span>Desechables (${cartSnapshot.orderType}):</span>
          <span>+${formatCurrency(cartSnapshot.disposableFee)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;">
          <span>Impoconsumo (8%):</span>
          <span>${formatCurrency(cartSnapshot.taxAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:900;margin-top:4px;">
          <span>TOTAL:</span>
          <span>${formatCurrency(total)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#555;">
          <span>Método de Pago:</span>
          <span>${methodType || 'EFECTIVO'}</span>
        </div>
      </div>

      <div style="text-align:center;font-size:11px;margin-bottom:12px;">
        <p style="margin:0;font-weight:700;">¡Gracias por tu compra en Ardientes! 🔥</p>
        <p style="margin:2px 0 0 0;font-size:10px;color:#777;">Vuelve pronto</p>
      </div>

      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" id="btn-print-receipt" style="flex:1;">🖨️ Imprimir</button>
        <button class="btn btn-primary btn-sm" id="btn-close-receipt" style="flex:1;">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(receiptOverlay);

  const closeReceipt = () => {
    receiptOverlay.remove();
    selectedMethodId   = null;
    selectedMethodType = null;
    amountPaid         = 0;
    if (typeof resolvePromise === 'function') {
      resolvePromise({ success: true, orderId: order.id });
    }
  };

  receiptOverlay.querySelector('#btn-close-receipt').addEventListener('click', closeReceipt);
  receiptOverlay.querySelector('#btn-print-receipt').addEventListener('click', () => {
    globalThis.print();
  });
  receiptOverlay.addEventListener('click', (e) => {
    if (e.target === receiptOverlay) closeReceipt();
  });
}

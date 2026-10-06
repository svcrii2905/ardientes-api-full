/**
 * orders.js — Vista de gestión de pedidos
 * Conecta con: GET /api/v1/orders y PATCH /api/v1/orders/:id/status
 */
import { ordersService } from '../services/orders.service.js';
import { wsService } from '../services/websocket.service.js';
import { formatCurrency } from '../utils/currency.js';
import { toast } from '../utils/notify.js';
import { CONFIG } from '../config.js';
import { store } from '../store/state.js';
import { openPaymentModal } from './paymentModal.js';
import { openDispatchModal } from './dispatchModal.js';
import { openOrderDetailModal } from './orderDetailModal.js';

let wsUnsubscribers = [];

export async function renderOrders(container) {
  // Limpiar listeners previos
  wsUnsubscribers.forEach(unsub => unsub());
  wsUnsubscribers = [];
  container.innerHTML = `
    <div class="page-layout">
      <div class="page-header">
        <div>
          <h1 class="page-title">🧾 Pedidos</h1>
        </div>
        <div style="display:flex;gap:var(--space-3);align-items:center">
          <!-- Filtro por estado -->
          <select class="input" id="filter-status" style="width:180px">
            <option value="">Todos los estados</option>
            ${Object.entries(CONFIG.ORDER_STATUSES).map(([k,v]) =>
              `<option value="${k}">${v.icon} ${v.label}</option>`
            ).join('')}
          </select>
          <!-- Filtro por tipo -->
          <select class="input" id="filter-type" style="width:160px">
            <option value="">Todos los tipos</option>
            ${CONFIG.ORDER_TYPES.map(t => `<option value="${t.value}">${t.icon} ${t.label}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" id="btn-refresh-orders">🔄 Actualizar</button>
        </div>
      </div>

      <div class="page-body">
        <div id="orders-table-wrap">
          <div style="text-align:center;padding:var(--space-10);color:var(--text-muted)">
            <div class="spinner" style="margin:0 auto var(--space-4)"></div>
            Cargando pedidos...
          </div>
        </div>
      </div>
    </div>
  `;

  bindOrdersEvents(container);
  await loadOrders(container);

  // Escuchar eventos en tiempo real para refrescar la tabla automáticamente
  const refreshAction = () => {
    loadOrders(container);
  };

  wsUnsubscribers.push(wsService.on('ORDER_CREATED', refreshAction));
  wsUnsubscribers.push(wsService.on('ORDER_STATUS_CHANGED', refreshAction));
  wsUnsubscribers.push(wsService.on('ORDER_CANCELLED', refreshAction));
  wsUnsubscribers.push(wsService.on('reconnected', refreshAction));

  const handlePaymentCompleted = () => refreshAction();
  globalThis.addEventListener('payment:completed', handlePaymentCompleted);
  wsUnsubscribers.push(() => globalThis.removeEventListener('payment:completed', handlePaymentCompleted));
}

async function loadOrders(container) {
  const statusEl = container.querySelector('#filter-status');
  const typeEl = container.querySelector('#filter-type');
  const wrap = container.querySelector('#orders-table-wrap');

  const filters = {
    status: statusEl?.value || undefined,
    orderType: typeEl?.value || undefined,
    limit: 50,
  };

  try {
    const res = await ordersService.listOrders(filters);
    const orders = res.data ?? [];
    renderOrdersTable(wrap, orders);
  } catch (e) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <p>Error al cargar pedidos: ${e.message}</p>
      </div>`;
  }
}

function renderOrdersTable(wrap, orders) {
  if (!orders.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>No hay pedidos con los filtros seleccionados</p>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="data-table" id="orders-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Tipo</th>
          <th>Estado</th>
          <th>Total</th>
          <th>Fecha</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(order => renderOrderRow(order)).join('')}
      </tbody>
    </table>
  `;

}

function renderOrderRow(order) {
  const statusCfg = CONFIG.ORDER_STATUSES[order.status] || { label: order.status, icon: '?' };
  const typeCfg   = CONFIG.ORDER_TYPES.find(t => t.value === order.orderType) || { icon: '?', label: order.orderType };
  const next      = getNextStatus(order.status, order.orderType);
  const canCancel = !['ENTREGADO', 'CANCELADO'].includes(order.status);
  const date      = order.createdAt ? new Date(order.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '-';
  const isPaid    = !!order.paidAt;
  const paymentBadge = isPaid
    ? `<span class="badge" style="background:rgba(46,213,115,0.1);color:var(--status-online)">🟢 Pagado</span>`
    : `<span class="badge" style="background:rgba(255,165,2,0.1);color:var(--amber-500)">🟠 Pendiente</span>`;

  const displayNum = order.dailyOrderNumber ? `PEDIDO ${order.dailyOrderNumber}` : (order.orderNumber || `#${order.id}`);
  const isDomicilioListo = order.orderType === 'DOMICILIO' && order.status === 'LISTO';

  return `
    <tr data-order-id="${order.id}" data-status="${order.status}" data-order-type="${order.orderType}">
      <td><strong style="color:var(--amber-500)">${displayNum}</strong></td>
      <td>
        <div>${typeCfg.icon} ${typeCfg.label}${order.tableId ? ` · Mesa ${order.tableId}` : ''}</div>
        ${order.orderType === 'DOMICILIO' && order.deliveryAddress
          ? `<div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:3px;white-space:normal;max-width:200px;">📍 ${order.deliveryAddress}</div>`
          : ''}
      </td>
      <td>
        <span class="badge badge-${order.status}">
          ${statusCfg.icon} ${statusCfg.label}
        </span>
        ${paymentBadge}
      </td>
      <td><strong>${formatCurrency(order.total)}</strong></td>
      <td style="color:var(--text-muted);font-size:var(--text-xs)">${date}</td>
      <td>
        <div style="display:flex;gap:var(--space-2)">
          <button class="btn btn-outline btn-sm" data-order-action="view" data-order-id="${order.id}">
            👁️ Ver
          </button>
          ${!isPaid && order.status !== 'CANCELADO' ? `
            <button class="btn btn-primary btn-sm" data-order-action="pay" data-order-id="${order.id}">
              💳 Cobrar
            </button>` : ''}
          ${isDomicilioListo ? `
            <button class="btn btn-primary btn-sm" data-order-action="dispatch" data-order-id="${order.id}">
              🛵 ENVIAR
            </button>` : (next ? `
            <button class="btn btn-success btn-sm" data-order-action="next-status" data-order-id="${order.id}">
              ${CONFIG.ORDER_STATUSES[next]?.icon} ${CONFIG.ORDER_STATUSES[next]?.label}
            </button>` : '')}
          ${canCancel ? `
            <button class="btn btn-danger btn-sm" data-order-action="cancel" data-order-id="${order.id}">
              ✕ Cancelar
            </button>` : ''}
        </div>
      </td>
    </tr>
  `;
}

function getNextStatus(current, orderType) {
  let flow = ['PENDIENTE','CONFIRMADO','EN_PREPARACION','LISTO','ENTREGADO'];
  if (orderType === 'DOMICILIO') {
    flow = ['PENDIENTE','CONFIRMADO','EN_PREPARACION','LISTO','EN_CAMINO','ENTREGADO'];
  }
  const idx = flow.indexOf(current);
  return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
}

function bindOrdersEvents(container) {
  container.querySelector('#btn-refresh-orders')?.addEventListener('click', () => loadOrders(container));
  container.querySelector('#filter-status')?.addEventListener('change', () => loadOrders(container));
  container.querySelector('#filter-type')?.addEventListener('change', () => loadOrders(container));

  const wrap = container.querySelector('#orders-table-wrap');
  if (wrap) {
    wrap.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-order-action]');
      if (!btn) return;

      const action  = btn.dataset.orderAction;
      const orderId = Number(btn.dataset.orderId);
      const user    = store.get('currentUser');

      if (action === 'view') {
        btn.disabled = true;
        try {
          const orderDetail = await ordersService.getOrderById(orderId);
          openOrderDetailModal(orderDetail);
        } catch (e) {
          toast.error(e.message);
        } finally {
          btn.disabled = false;
        }
        return;
      }

      if (action === 'dispatch') {
        btn.disabled = true;
        try {
          const orderDetail = await ordersService.getOrderById(orderId);
          const result = await openDispatchModal({
            order: orderDetail,
            _onConfirm: async (data) => {
              await ordersService.dispatchDelivery(orderId, data.deliveryUserId, data.deliveryCompany);
            }
          });
          if (result && result.success) {
            toast.success('🛵 Pedido enviado con éxito');
            await loadOrders(container);
          }
        } catch (e) {
          toast.error(e.message);
        } finally {
          btn.disabled = false;
        }
        return;
      }

      if (action === 'next-status') {
        const row    = btn.closest('tr');
        const status = row.dataset.status;
        const type   = row.dataset.orderType;
        const next   = getNextStatus(status, type);
        if (!next) return;

        btn.disabled = true;
        try {
          await ordersService.changeStatus(orderId, next, user.id);
          toast.success(`Pedido #${orderId} → ${CONFIG.ORDER_STATUSES[next]?.label}`);
          await loadOrders(container);
        } catch (e) {
          toast.error(e.message);
          btn.disabled = false;
        }
      }

      if (action === 'cancel') {
        const reason = prompt('Motivo de cancelación:');
        if (!reason) return;
        try {
          await ordersService.cancelOrder(orderId, user.id, reason);
          toast.warning('Pedido cancelado');
          await loadOrders(container);
        } catch (e) {
          toast.error(e.message);
        }
      }

      if (action === 'pay') {
        btn.disabled = true;
        try {
          const orderDetail = await ordersService.getOrderById(orderId);
          await openPaymentModal(orderDetail, null);
          await loadOrders(container);
        } catch (e) {
          toast.error('Error al cargar detalles del pedido para cobro: ' + e.message);
        } finally {
          btn.disabled = false;
        }
      }
    });
  }
}

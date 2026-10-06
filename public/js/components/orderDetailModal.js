import { formatCurrency } from '../utils/currency.js';

export function openOrderDetailModal(order) {
  if (document.getElementById('order-detail-modal-overlay')) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'order-detail-modal-overlay';

  const orderTitleLabel = order.dailyOrderNumber 
    ? `PEDIDO ${order.dailyOrderNumber}` 
    : (order.orderNumber ? `Pedido #${order.orderNumber}` : `Pedido #${order.id}`);
  
  const addressInfo = order.deliveryAddress 
    ? `<div style="margin-top: 5px; color: var(--text-muted); font-size: 0.9em;">📍 ${order.deliveryAddress}</div>` 
    : '';
  
  const customerInfo = order.customerName 
    ? `<div style="margin-top: 5px; color: var(--text-muted); font-size: 0.9em;">👤 ${order.customerName}</div>` 
    : '';

  // Items
  let itemsHtml = '';
  if (order.items && order.items.length > 0) {
    itemsHtml = order.items.map(item => {
      let toppingsHtml = '';
      if (item.toppings && item.toppings.length > 0) {
        toppingsHtml = `<div style="font-size: 0.85em; color: var(--text-muted); margin-left: 15px;">` +
          item.toppings.map(t => `+ ${t.toppingName}`).join('<br>') +
        `</div>`;
      }
      let notesHtml = '';
      if (item.notes) {
        notesHtml = `<div style="font-size: 0.85em; color: var(--amber-500); margin-left: 15px;">⚠️ ${item.notes}</div>`;
      }
      return `
        <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed var(--border-color);">
          <div style="display: flex; justify-content: space-between;">
            <strong>${item.quantity}x ${item.productName || 'Producto'} ${item.menuType === 'ESPECIAL' ? '(Especial)' : ''}</strong>
            <span>${formatCurrency(item.lineTotal ?? (item.unitPrice * item.quantity))}</span>
          </div>
          ${toppingsHtml}
          ${notesHtml}
        </div>
      `;
    }).join('');
  }

  // Beverages
  let beveragesHtml = '';
  if (order.beverages && order.beverages.length > 0) {
    beveragesHtml = `<h4 style="margin-top: 15px; margin-bottom: 5px;">Bebidas</h4>` + 
      order.beverages.map(b => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
          <span>${b.quantity}x ${b.beverageName || 'Bebida'}</span>
          <span>${formatCurrency(b.lineTotal ?? (b.unitPrice * b.quantity))}</span>
        </div>
      `).join('');
  }

  // General Notes
  let generalNotesHtml = '';
  if (order.notes) {
    generalNotesHtml = `
      <div style="margin-top: 15px; padding: 10px; background: rgba(255,165,2,0.1); border-left: 3px solid var(--amber-500);">
        <strong>Nota general:</strong> ${order.notes}
      </div>
    `;
  }

  // Totals
  const totalsHtml = `
    <div style="margin-top: 20px; border-top: 2px solid var(--border-color); padding-top: 10px;">
      ${order.subtotal != null ? `<div style="display: flex; justify-content: space-between; color: var(--text-muted); margin-bottom: 5px;"><span>Subtotal:</span> <span>${formatCurrency(order.subtotal)}</span></div>` : ''}
      ${order.discountAmount ? `<div style="display: flex; justify-content: space-between; color: var(--status-online); margin-bottom: 5px;"><span>Descuento:</span> <span>-${formatCurrency(order.discountAmount)}</span></div>` : ''}
      ${order.taxAmount ? `<div style="display: flex; justify-content: space-between; color: var(--text-muted); margin-bottom: 5px;"><span>Impuesto:</span> <span>${formatCurrency(order.taxAmount)}</span></div>` : ''}
      ${order.total != null ? `<div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2em; margin-top: 10px;"><span>TOTAL:</span> <span>${formatCurrency(order.total)}</span></div>` : ''}
    </div>
  `;

  overlay.innerHTML = `
    <div class="modal-content" style="max-width: 500px; width: 100%;">
      <div class="modal-header">
        <h2 class="modal-title">👁️ Detalle del Pedido</h2>
        <button class="btn-close" id="btn-close-detail-modal">✕</button>
      </div>
      <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
        <h3 style="margin-bottom: 5px; color: var(--amber-500);">${orderTitleLabel}</h3>
        <div style="margin-bottom: 15px;">
          <span class="badge badge-${order.status}">${order.status}</span>
          <span class="badge" style="background:var(--bg-card); border: 1px solid var(--border-color);">${order.orderType}</span>
          ${customerInfo}
          ${addressInfo}
        </div>
        
        ${itemsHtml}
        ${beveragesHtml}
        ${generalNotesHtml}
        ${totalsHtml}
      </div>
      <div class="modal-footer" style="display: flex; justify-content: flex-end;">
        <button class="btn btn-primary" id="btn-ok-detail-modal">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const btnOk = overlay.querySelector('#btn-ok-detail-modal');
  const btnClose = overlay.querySelector('#btn-close-detail-modal');

  const closeModal = () => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };

  btnOk.addEventListener('click', closeModal);
  btnClose.addEventListener('click', closeModal);
}

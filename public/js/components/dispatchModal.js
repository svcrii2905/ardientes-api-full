/**
 * dispatchModal.js — Modal para seleccionar domiciliario y enviar pedido
 */
import { toast } from '../utils/notify.js';

let isProcessing = false;

export function openDispatchModal({ order, _onConfirm }) {
  if (document.getElementById('dispatch-modal-overlay')) {
    console.warn('openDispatchModal: Ya existe un modal abierto en el DOM.');
    return Promise.resolve({ success: false, reason: 'already_open' });
  }

  return new Promise((resolve) => {
    isProcessing = false;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'dispatch-modal-overlay';

    const orderTitleLabel = order.dailyOrderNumber ? `PEDIDO ${order.dailyOrderNumber}` : (order.orderNumber ? `Pedido #${order.orderNumber}` : `Pedido #${order.id}`);
    const addressInfo = order.deliveryAddress ? `<div style="margin-bottom: var(--space-4); color: var(--text-muted);">📍 ${order.deliveryAddress}</div>` : '';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h2 class="modal-title">🛵 Enviar domicilio</h2>
          <button class="btn-close" id="btn-close-dispatch-modal">✕</button>
        </div>
        <div class="modal-body">
          <h3 style="margin-bottom: var(--space-2); color: var(--amber-500);">${orderTitleLabel}</h3>
          ${addressInfo}
          
          <div style="margin-bottom: var(--space-4);">
            <label class="label">Empresa de domicilio</label>
            <select class="input" id="select-driver">
              <option value="">[ Seleccionar empresa ▼ ]</option>
            </select>
          </div>
        </div>
        <div class="modal-footer" style="display: flex; gap: var(--space-2); justify-content: flex-end;">
          <button class="btn btn-secondary" id="btn-cancel-dispatch">Cancelar</button>
          <button class="btn btn-primary" id="btn-confirm-dispatch" disabled>🛵 Enviar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const selectDriverEl = overlay.querySelector('#select-driver');
    const btnCancel = overlay.querySelector('#btn-cancel-dispatch');
    const btnConfirm = overlay.querySelector('#btn-confirm-dispatch');
    const btnClose = overlay.querySelector('#btn-close-dispatch-modal');

    const closeModal = (reason = 'cancel') => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      resolve({ success: false, reason });
    };

    btnCancel.addEventListener('click', () => closeModal());
    btnClose.addEventListener('click', () => closeModal());

    const companies = [
      'Movil Ya',
      'VIP',
      'Rapicón',
      'Domi Turbo',
      'Domicilios Camila',
      'Johan Santa'
    ];

    companies.forEach(comp => {
      const opt = document.createElement('option');
      opt.value = comp;
      opt.textContent = comp;
      selectDriverEl.appendChild(opt);
    });

    selectDriverEl.addEventListener('change', () => {
      btnConfirm.disabled = !selectDriverEl.value || isProcessing;
    });

    btnConfirm.addEventListener('click', () => {
      const selectedId = selectDriverEl.value;
      if (!selectedId) {
        toast.warning('Debe seleccionar una empresa.');
        return;
      }

      if (isProcessing) return;
      isProcessing = true;
      btnConfirm.disabled = true;
      btnCancel.disabled = true;
      btnClose.disabled = true;
      selectDriverEl.disabled = true;
      btnConfirm.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;border-top-color:#fff;"></span> Enviando...';

      Promise.resolve(_onConfirm({ deliveryCompany: selectedId }))
        .then(() => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
          resolve({ success: true, deliveryCompany: selectedId });
        })
        .catch(e => {
          toast.error(e.message || 'Error al despachar pedido');
          isProcessing = false;
          btnConfirm.disabled = false;
          btnCancel.disabled = false;
          btnClose.disabled = false;
          selectDriverEl.disabled = false;
          btnConfirm.innerHTML = '🛵 Enviar';
        });
    });
  });
}

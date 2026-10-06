/**
 * customerActivationModal.js — Modal en Caja para visualización y entrega de código de activación
 * Muestra el código temporal generado (XXXX-XXXX) al colaborador de Caja para dictarlo o imprimirlo.
 */
import { toast } from '../utils/notify.js';

export function openCustomerActivationModal({ customerName, phone, activationCode, expiresAt, onDone } = {}) {
  // Remover modal existente si hubiera
  const existing = document.getElementById('customer-activation-modal');
  if (existing) existing.remove();

  const formattedExpires = expiresAt
    ? new Date(expiresAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : '24 horas';

  const modal = document.createElement('div');
  modal.id = 'customer-activation-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: var(--space-4, 16px); box-sizing: border-box;
  `;

  modal.innerHTML = `
    <div class="panel" style="
      width: 100%; max-width: 440px; background: var(--bg-surface, #1C1008);
      border: 1px solid var(--border-medium, rgba(255, 100, 20, 0.3));
      border-radius: var(--radius-lg, 12px); box-shadow: 0 15px 35px rgba(0,0,0,0.6);
      padding: var(--space-6, 24px); display: flex; flex-direction: column; gap: var(--space-4, 16px);
      box-sizing: border-box; animation: modalFadeIn 180ms ease;
    ">
      <!-- Cabecera -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--amber-400); font-weight: 700; letter-spacing: 0.5px;">
            Código de Activación Web
          </span>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin: 2px 0 0 0;">
            ${customerName}
          </h2>
          <p style="font-size: 0.84rem; color: var(--text-secondary); margin: 2px 0 0 0; font-family: monospace;">
            📞 ${phone}
          </p>
        </div>
        <button type="button" id="btn-modal-close-x" style="
          background: transparent; border: none; font-size: 1.25rem; color: var(--text-muted);
          cursor: pointer; padding: 4px 8px; line-height: 1; border-radius: 4px;
        ">✕</button>
      </div>

      <!-- Caja del Código Destacado -->
      <div style="
        background: #0D0704; border: 2px dashed var(--fire-500, #FF5500);
        border-radius: var(--radius-md, 10px); padding: 18px; text-align: center;
        display: flex; flex-direction: column; gap: 6px;
      ">
        <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">
          Código de Activación Temporal (1 solo uso)
        </span>
        <div id="display-activation-code" style="
          font-family: monospace; font-size: 2.2rem; font-weight: 900;
          color: var(--amber-400, #FFB830); letter-spacing: 4px; line-height: 1.1;
        ">
          ${activationCode}
        </div>
        <span style="font-size: 0.78rem; color: var(--text-secondary);">
          ⏱️ Vigente por 24 horas (hasta las ${formattedExpires})
        </span>
      </div>

      <!-- Instrucciones para el Cajero / Cliente -->
      <div style="
        background: rgba(255, 165, 0, 0.08); border: 1px solid rgba(255, 165, 0, 0.2);
        border-radius: var(--radius-md, 8px); padding: 12px; font-size: 0.82rem;
        color: var(--text-secondary); line-height: 1.4;
      ">
        <p style="margin: 0; color: var(--amber-300); font-weight: 600;">
          💬 Mensaje para indicarle al cliente:
        </p>
        <p style="margin: 4px 0 0 0;">
          "Ingresa en la web a <strong>CLIENTE > ACTIVAR CUENTA</strong>, digita tu número telefónico y este código para crear tu contraseña y conservar todos tus puntos."
        </p>
      </div>

      <!-- Acciones: Copiar, Imprimir, Cerrar -->
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <button type="button" id="btn-copy-code" class="btn btn-secondary" style="
            height: 42px; font-weight: 700; font-size: 0.88rem; display: flex; align-items: center; justify-content: center; gap: 6px;
          ">
            <span>📋</span>
            <span id="text-copy-btn">Copiar Código</span>
          </button>

          <button type="button" id="btn-print-code" class="btn btn-secondary" style="
            height: 42px; font-weight: 700; font-size: 0.88rem; display: flex; align-items: center; justify-content: center; gap: 6px;
          ">
            <span>🖨️</span>
            <span>Imprimir Ticket</span>
          </button>
        </div>

        <button type="button" id="btn-modal-done" class="btn btn-primary" style="
          width: 100%; height: 44px; font-weight: 700; font-size: 0.92rem;
        ">
          Listo / Cerrar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  function closeModal() {
    modal.remove();
    if (onDone) onDone();
  }

  // Copiar código al portapapeles
  const copyBtn = modal.querySelector('#btn-copy-code');
  const copyText = modal.querySelector('#text-copy-btn');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(activationCode);
      copyText.textContent = '¡Copiado!';
      toast.success('Código copiado al portapapeles');
      setTimeout(() => {
        if (copyText) copyText.textContent = 'Copiar Código';
      }, 2000);
    } catch {
      toast.info(`Código: ${activationCode}`);
    }
  });

  // Botón preparado para impresión
  const printBtn = modal.querySelector('#btn-print-code');
  printBtn.addEventListener('click', () => {
    toast.info('Ticket preparado para impresión térmica.');
  });

  // Cerrar modal
  modal.querySelector('#btn-modal-close-x').addEventListener('click', closeModal);
  modal.querySelector('#btn-modal-done').addEventListener('click', closeModal);
}

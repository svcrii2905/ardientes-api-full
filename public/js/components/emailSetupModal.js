/**
 * emailSetupModal.js — Modal para vincular o actualizar el correo electrónico del usuario
 */
import { authService } from '../services/auth.service.js';
import { toast } from '../utils/notify.js';

export function openEmailSetupModal({ mandatory = false, onComplete = null } = {}) {
  if (document.getElementById('email-setup-modal-overlay')) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'email-setup-modal-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    padding: var(--space-4);
  `;

  let currentStep = 1; // 1: Datos (Password + Nuevo Email), 2: Confirmar código
  let userEmail = '';
  let currentPassword = '';
  let resendCountdown = 0;
  let resendTimer = null;

  function renderModal() {
    overlay.innerHTML = `
      <div class="panel" style="
        width: 100%; max-width: 420px; padding: var(--space-6);
        background: var(--bg-surface); border: 1px solid var(--border-color);
        border-radius: var(--radius-lg); box-shadow: 0 15px 35px rgba(0,0,0,0.6);
        display: flex; flex-direction: column; gap: var(--space-4);
        position: relative;
      ">
        <!-- Botón cerrar (solo si no es mandatorio) -->
        ${
          !mandatory
            ? `
          <button id="btn-close-email-setup" style="
            position: absolute; top: 16px; right: 16px;
            background: transparent; border: none; color: var(--text-muted);
            font-size: 1.25rem; cursor: pointer; padding: 4px 8px; border-radius: 4px;
          ">✕</button>
        `
            : ''
        }

        <!-- Cabecera -->
        <div style="text-align: center;">
          <div style="
            width: 56px; height: 56px; border-radius: 50%;
            background: linear-gradient(135deg, #FF5500, #FF9900);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.75rem; margin: 0 auto var(--space-3) auto;
            box-shadow: 0 0 25px rgba(255,85,0,0.3);
          ">🛡️</div>
          <h2 style="font-size: var(--text-lg); margin-bottom: var(--space-1); font-weight: 700;">
            ${mandatory ? 'Protege tu cuenta de Ardientes POS' : 'Configurar / Cambiar Correo'}
          </h2>
          <p style="color: var(--text-muted); font-size: var(--text-sm); line-height: 1.4;">
            ${
              currentStep === 1
                ? (mandatory
                    ? 'Tu cuenta aún no tiene un correo válido registrado. Vincula tu correo para poder recuperar tu acceso si olvidas tu contraseña.'
                    : 'Ingresa tu contraseña actual y el nuevo correo que deseas asociar a tu cuenta.')
                : `Ingresa el código de 6 dígitos enviado a <br><strong style="color:var(--text-primary)">${userEmail}</strong>`
            }
          </p>
        </div>

        <!-- Mensaje de error -->
        <div id="setup-error-box" style="
          display: none; padding: var(--space-2) var(--space-3);
          background: rgba(239, 68, 68, 0.15); color: #EF4444;
          border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md);
          font-size: var(--text-sm); text-align: center;
        "></div>

        <!-- Formularios -->
        ${
          currentStep === 1
            ? `
            <form id="setup-step-1" style="display:flex; flex-direction:column; gap:var(--space-3);">
              <div class="form-group">
                <label class="form-label" for="setup-password">Contraseña Actual</label>
                <div style="position:relative;">
                  <input class="form-input" type="password" id="setup-password" required autofocus autocomplete="current-password" style="padding-right:40px;" />
                  <button type="button" class="btn-toggle-eye" data-target="setup-password" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;">👁️</button>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="setup-email">Nuevo Correo Electrónico</label>
                <input class="form-input" type="email" id="setup-email" placeholder="tu-correo@gmail.com" required autocomplete="email" />
              </div>
              <button class="btn btn-primary" type="submit" id="btn-submit-setup1" style="height: 44px; margin-top: var(--space-2);">
                <span>ENVIAR CÓDIGO DE VERIFICACIÓN</span>
              </button>
              ${
                mandatory
                  ? `
                <button type="button" id="btn-skip-setup" style="
                  background: none; border: none; color: var(--text-muted);
                  font-size: var(--text-xs); cursor: pointer; text-decoration: underline; margin-top: 4px;
                ">
                  Recordarme más tarde
                </button>
              `
                  : ''
              }
            </form>
          `
            : `
            <form id="setup-step-2" style="display:flex; flex-direction:column; gap:var(--space-3);">
              <div class="form-group">
                <label class="form-label" for="setup-code" style="text-align:center;">Código de 6 Dígitos</label>
                <input class="form-input" type="text" id="setup-code" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" placeholder="123456" style="text-align:center; font-size:1.5rem; letter-spacing:6px; font-family:monospace; font-weight:bold;" required autofocus autocomplete="one-time-code" />
              </div>
              <button class="btn btn-primary" type="submit" id="btn-submit-setup2" style="height: 44px; margin-top: var(--space-2);">
                <span>CONFIRMAR Y ASOCIAR CORREO</span>
              </button>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:var(--space-2); font-size:var(--text-xs);">
                <button type="button" id="btn-back-setup" style="background:none; border:none; color:var(--text-muted); cursor:pointer; text-decoration:underline;">
                  ← Cambiar correo
                </button>
                <button type="button" id="btn-resend-setup-code" style="background:none; border:none; color:var(--color-primary, #FF5500); cursor:pointer; font-weight:600;" ${resendCountdown > 0 ? 'disabled' : ''}>
                  ${resendCountdown > 0 ? `Reenviar en ${resendCountdown}s` : 'Reenviar código'}
                </button>
              </div>
            </form>
          `
        }
      </div>
    `;

    bindEvents();
  }

  function showError(msg) {
    const box = overlay.querySelector('#setup-error-box');
    if (box) {
      box.style.display = 'block';
      box.textContent = msg;
    }
  }

  function hideError() {
    const box = overlay.querySelector('#setup-error-box');
    if (box) {
      box.style.display = 'none';
      box.textContent = '';
    }
  }

  function startResendTimer() {
    resendCountdown = 60;
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      resendCountdown--;
      const btn = overlay.querySelector('#btn-resend-setup-code');
      if (btn) {
        if (resendCountdown > 0) {
          btn.textContent = `Reenviar en ${resendCountdown}s`;
          btn.disabled = true;
        } else {
          btn.textContent = 'Reenviar código';
          btn.disabled = false;
          clearInterval(resendTimer);
        }
      }
      if (resendCountdown <= 0) clearInterval(resendTimer);
    }, 1000);
  }

  function closeModal() {
    globalThis.removeEventListener('auth:unauthorized', handleUnauthorized);
    if (resendTimer) clearInterval(resendTimer);
    overlay.remove();
  }

  function handleUnauthorized() {
    closeModal();
    toast.error('Tu sesión ha expirado o es inválida. Por favor, inicia sesión nuevamente.');
  }

  globalThis.addEventListener('auth:unauthorized', handleUnauthorized, { once: true });

  function bindEvents() {
    overlay.querySelector('#btn-close-email-setup')?.addEventListener('click', closeModal);
    overlay.querySelector('#btn-skip-setup')?.addEventListener('click', closeModal);

    // Toggle eye
    overlay.querySelectorAll('.btn-toggle-eye').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = overlay.querySelector(`#${btn.dataset.target}`);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      });
    });

    // Paso 1
    const form1 = overlay.querySelector('#setup-step-1');
    if (form1) {
      form1.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        if (!authService.getToken()) {
          closeModal();
          toast.error('Tu sesión ha expirado o es inválida. Por favor, inicia sesión nuevamente.');
          return;
        }

        currentPassword = overlay.querySelector('#setup-password').value;
        userEmail = overlay.querySelector('#setup-email').value.trim().toLowerCase();

        if (!currentPassword || !userEmail) return;

        const btn = overlay.querySelector('#btn-submit-setup1');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block"></span>';

        try {
          await authService.requestEmailSetup(currentPassword, userEmail);
          currentStep = 2;
          startResendTimer();
          renderModal();
        } catch (err) {
          if (err.status === 401 || !authService.getToken() || err.message?.includes('Autenticación') || err.message?.includes('expirad') || err.message?.includes('Sesión')) {
            closeModal();
            toast.error('Tu sesión ha expirado o es inválida. Por favor, inicia sesión nuevamente.');
            return;
          }
          showError(err.message || 'Error al solicitar código');
          btn.disabled = false;
          btn.innerHTML = '<span>ENVIAR CÓDIGO DE VERIFICACIÓN</span>';
        }
      });
    }

    // Paso 2
    const form2 = overlay.querySelector('#setup-step-2');
    if (form2) {
      overlay.querySelector('#btn-back-setup')?.addEventListener('click', () => {
        currentStep = 1;
        renderModal();
      });

      overlay.querySelector('#btn-resend-setup-code')?.addEventListener('click', async () => {
        if (resendCountdown > 0) return;
        hideError();
        if (!authService.getToken()) {
          closeModal();
          toast.error('Tu sesión ha expirado o es inválida. Por favor, inicia sesión nuevamente.');
          return;
        }
        try {
          await authService.requestEmailSetup(currentPassword, userEmail);
          toast.success('Código reenviado a tu correo');
          startResendTimer();
        } catch (err) {
          if (err.status === 401 || !authService.getToken() || err.message?.includes('Autenticación') || err.message?.includes('expirad') || err.message?.includes('Sesión')) {
            closeModal();
            toast.error('Tu sesión ha expirado o es inválida. Por favor, inicia sesión nuevamente.');
            return;
          }
          showError(err.message || 'Error al reenviar código');
        }
      });

      form2.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        if (!authService.getToken()) {
          closeModal();
          toast.error('Tu sesión ha expirado o es inválida. Por favor, inicia sesión nuevamente.');
          return;
        }

        const codeInput = overlay.querySelector('#setup-code');
        const code = codeInput.value.trim();
        if (!code || code.length !== 6) {
          showError('Ingresa los 6 dígitos numéricos');
          return;
        }

        const btn = overlay.querySelector('#btn-submit-setup2');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block"></span>';

        try {
          const resp = await authService.confirmEmailSetup(userEmail, code);
          closeModal();
          toast.success(resp.message || 'Correo verificado y asociado con éxito');
          if (onComplete) onComplete();
        } catch (err) {
          if (err.status === 401 || !authService.getToken() || err.message?.includes('Autenticación') || err.message?.includes('expirad') || err.message?.includes('Sesión')) {
            closeModal();
            toast.error('Tu sesión ha expirado o es inválida. Por favor, inicia sesión nuevamente.');
            return;
          }
          showError(err.message || 'Código incorrecto');
          btn.disabled = false;
          btn.innerHTML = '<span>CONFIRMAR Y ASOCIAR CORREO</span>';
          codeInput.value = '';
          codeInput.focus();
        }
      });
    }
  }

  renderModal();
  document.body.appendChild(overlay);
}

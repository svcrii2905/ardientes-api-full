/**
 * passwordResetModal.js — Modal guiado para recuperación de contraseña (3 pasos)
 */
import { authService } from '../services/auth.service.js';
import { toast } from '../utils/notify.js';

export function openPasswordResetModal(prefilledEmail = '') {
  if (document.getElementById('pwd-reset-modal-overlay')) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'pwd-reset-modal-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: var(--space-4);
  `;

  let currentStep = 1; // 1: Email, 2: Code, 3: New Password
  let userEmail = prefilledEmail || '';
  let resetToken = '';
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
        <!-- Botón cerrar -->
        <button id="btn-close-reset" style="
          position: absolute; top: 16px; right: 16px;
          background: transparent; border: none; color: var(--text-muted);
          font-size: 1.25rem; cursor: pointer; padding: 4px 8px; border-radius: 4px;
        ">✕</button>

        <!-- Cabecera -->
        <div style="text-align: center;">
          <div style="
            width: 56px; height: 56px; border-radius: 50%;
            background: linear-gradient(135deg, #FF5500, #FF9900);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.75rem; margin: 0 auto var(--space-3) auto;
            box-shadow: 0 0 25px rgba(255,85,0,0.3);
          ">🔑</div>
          <h2 style="font-size: var(--text-lg); margin-bottom: var(--space-1); font-weight: 700;">
            ${currentStep === 1 ? 'Recuperar Contraseña' : currentStep === 2 ? 'Verificar Código' : 'Nueva Contraseña'}
          </h2>
          <p style="color: var(--text-muted); font-size: var(--text-sm); line-height: 1.4;">
            ${
              currentStep === 1
                ? 'Ingresa tu correo registrado para recibir un código de 6 dígitos.'
                : currentStep === 2
                ? `Ingresa el código de 6 dígitos enviado a <br><strong style="color:var(--text-primary)">${userEmail}</strong>`
                : 'Crea tu nueva contraseña segura de al menos 6 caracteres.'
            }
          </p>
        </div>

        <!-- Mensaje de error -->
        <div id="reset-error-box" style="
          display: none; padding: var(--space-2) var(--space-3);
          background: rgba(239, 68, 68, 0.15); color: #EF4444;
          border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md);
          font-size: var(--text-sm); text-align: center;
        "></div>

        <!-- Formularios por paso -->
        ${
          currentStep === 1
            ? `
            <form id="step-1-form" style="display:flex; flex-direction:column; gap:var(--space-3);">
              <div class="form-group">
                <label class="form-label" for="reset-email">Correo Electrónico</label>
                <input class="form-input" type="email" id="reset-email" value="${userEmail}" placeholder="ejemplo@ardientes.com" required autofocus />
              </div>
              <button class="btn btn-primary" type="submit" id="btn-submit-step1" style="height: 44px; margin-top: var(--space-2);">
                <span>ENVIAR CÓDIGO</span>
              </button>
            </form>
          `
            : currentStep === 2
            ? `
            <form id="step-2-form" style="display:flex; flex-direction:column; gap:var(--space-3);">
              <div class="form-group">
                <label class="form-label" for="reset-code" style="text-align:center;">Código de 6 Dígitos</label>
                <input class="form-input" type="text" id="reset-code" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" placeholder="123456" style="text-align:center; font-size:1.5rem; letter-spacing:6px; font-family:monospace; font-weight:bold;" required autofocus autocomplete="one-time-code" />
              </div>
              <button class="btn btn-primary" type="submit" id="btn-submit-step2" style="height: 44px; margin-top: var(--space-2);">
                <span>VERIFICAR CÓDIGO</span>
              </button>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:var(--space-2); font-size:var(--text-xs);">
                <button type="button" id="btn-back-step1" style="background:none; border:none; color:var(--text-muted); cursor:pointer; text-decoration:underline;">
                  ← Cambiar correo
                </button>
                <button type="button" id="btn-resend-code" style="background:none; border:none; color:var(--color-primary, #FF5500); cursor:pointer; font-weight:600;" ${resendCountdown > 0 ? 'disabled' : ''}>
                  ${resendCountdown > 0 ? `Reenviar en ${resendCountdown}s` : 'Reenviar código'}
                </button>
              </div>
            </form>
          `
            : `
            <form id="step-3-form" style="display:flex; flex-direction:column; gap:var(--space-3);">
              <div class="form-group">
                <label class="form-label" for="reset-new-password">Nueva Contraseña</label>
                <div style="position:relative;">
                  <input class="form-input" type="password" id="reset-new-password" minlength="6" required autofocus style="padding-right:40px;" />
                  <button type="button" class="btn-toggle-eye" data-target="reset-new-password" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;">👁️</button>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="reset-confirm-password">Confirmar Contraseña</label>
                <div style="position:relative;">
                  <input class="form-input" type="password" id="reset-confirm-password" minlength="6" required style="padding-right:40px;" />
                  <button type="button" class="btn-toggle-eye" data-target="reset-confirm-password" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;">👁️</button>
                </div>
              </div>
              <button class="btn btn-primary" type="submit" id="btn-submit-step3" style="height: 44px; margin-top: var(--space-2);">
                <span>ESTABLECER NUEVA CONTRASEÑA</span>
              </button>
            </form>
          `
        }
      </div>
    `;

    bindEvents();
  }

  function showError(msg) {
    const box = overlay.querySelector('#reset-error-box');
    if (box) {
      box.style.display = 'block';
      box.textContent = msg;
    }
  }

  function hideError() {
    const box = overlay.querySelector('#reset-error-box');
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
      const btn = overlay.querySelector('#btn-resend-code');
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
    if (resendTimer) clearInterval(resendTimer);
    overlay.remove();
  }

  function bindEvents() {
    overlay.querySelector('#btn-close-reset')?.addEventListener('click', closeModal);

    // Toggle de visibilidad de contraseñas
    overlay.querySelectorAll('.btn-toggle-eye').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = overlay.querySelector(`#${btn.dataset.target}`);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      });
    });

    // Paso 1: Enviar Código
    const form1 = overlay.querySelector('#step-1-form');
    if (form1) {
      form1.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        const emailInput = overlay.querySelector('#reset-email');
        userEmail = emailInput.value.trim().toLowerCase();
        if (!userEmail) return;

        const btn = overlay.querySelector('#btn-submit-step1');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block"></span>';

        try {
          await authService.requestPasswordReset(userEmail);
          currentStep = 2;
          startResendTimer();
          renderModal();
        } catch (err) {
          showError(err.message || 'Error al enviar código');
          btn.disabled = false;
          btn.innerHTML = '<span>ENVIAR CÓDIGO</span>';
        }
      });
    }

    // Paso 2: Verificar Código
    const form2 = overlay.querySelector('#step-2-form');
    if (form2) {
      overlay.querySelector('#btn-back-step1')?.addEventListener('click', () => {
        currentStep = 1;
        renderModal();
      });

      overlay.querySelector('#btn-resend-code')?.addEventListener('click', async () => {
        if (resendCountdown > 0) return;
        hideError();
        try {
          await authService.requestPasswordReset(userEmail);
          toast.success('Código reenviado a tu correo');
          startResendTimer();
        } catch (err) {
          showError(err.message || 'Error al reenviar código');
        }
      });

      form2.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        const codeInput = overlay.querySelector('#reset-code');
        const code = codeInput.value.trim();
        if (!code || code.length !== 6) {
          showError('Ingresa los 6 dígitos numéricos');
          return;
        }

        const btn = overlay.querySelector('#btn-submit-step2');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block"></span>';

        try {
          resetToken = await authService.verifyResetCode(userEmail, code);
          currentStep = 3;
          renderModal();
        } catch (err) {
          showError(err.message || 'Código incorrecto');
          btn.disabled = false;
          btn.innerHTML = '<span>VERIFICAR CÓDIGO</span>';
          codeInput.value = '';
          codeInput.focus();
        }
      });
    }

    // Paso 3: Establecer Contraseña
    const form3 = overlay.querySelector('#step-3-form');
    if (form3) {
      form3.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        const p1 = overlay.querySelector('#reset-new-password').value;
        const p2 = overlay.querySelector('#reset-confirm-password').value;

        if (p1.length < 6) {
          showError('La contraseña debe tener al menos 6 caracteres');
          return;
        }

        if (p1 !== p2) {
          showError('Las contraseñas no coinciden');
          return;
        }

        const btn = overlay.querySelector('#btn-submit-step3');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block"></span>';

        try {
          const resp = await authService.resetPassword(resetToken, p1);
          closeModal();
          toast.success(resp.message || 'Contraseña actualizada con éxito');
          // Colocar el correo prellenado en el formulario de login si está presente
          const loginId = document.getElementById('login-identifier');
          if (loginId) {
            loginId.value = userEmail;
            const loginPass = document.getElementById('login-password');
            if (loginPass) loginPass.focus();
          }
        } catch (err) {
          showError(err.message || 'Error al restablecer contraseña');
          btn.disabled = false;
          btn.innerHTML = '<span>ESTABLECER NUEVA CONTRASEÑA</span>';
        }
      });
    }
  }

  renderModal();
  document.body.appendChild(overlay);
}

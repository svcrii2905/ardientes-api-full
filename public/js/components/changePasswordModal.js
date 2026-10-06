/**
 * changePasswordModal.js — Modal para cambiar la contraseña de un usuario autenticado
 */
import { authService } from '../services/auth.service.js';
import { toast } from '../utils/notify.js';

export function openChangePasswordModal() {
  if (document.getElementById('change-pwd-modal-overlay')) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'change-pwd-modal-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: var(--space-4);
  `;

  overlay.innerHTML = `
    <div class="panel" style="
      width: 100%; max-width: 400px; padding: var(--space-6);
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--radius-lg); box-shadow: 0 15px 35px rgba(0,0,0,0.6);
      display: flex; flex-direction: column; gap: var(--space-4);
      position: relative;
    ">
      <button id="btn-close-change-pwd" style="
        position: absolute; top: 16px; right: 16px;
        background: transparent; border: none; color: var(--text-muted);
        font-size: 1.25rem; cursor: pointer; padding: 4px 8px; border-radius: 4px;
      ">✕</button>

      <div style="text-align: center;">
        <div style="
          width: 56px; height: 56px; border-radius: 50%;
          background: linear-gradient(135deg, #FF5500, #FF9900);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.75rem; margin: 0 auto var(--space-3) auto;
          box-shadow: 0 0 25px rgba(255,85,0,0.3);
        ">🔑</div>
        <h2 style="font-size: var(--text-lg); margin-bottom: var(--space-1); font-weight: 700;">Cambiar Contraseña</h2>
        <p style="color: var(--text-muted); font-size: var(--text-sm);">
          Ingresa tu contraseña actual y define tu nueva contraseña.
        </p>
      </div>

      <div id="change-pwd-error" style="
        display: none; padding: var(--space-2) var(--space-3);
        background: rgba(239, 68, 68, 0.15); color: #EF4444;
        border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md);
        font-size: var(--text-sm); text-align: center;
      "></div>

      <form id="change-pwd-form" style="display:flex; flex-direction:column; gap:var(--space-3);">
        <div class="form-group">
          <label class="form-label" for="current-pwd">Contraseña Actual</label>
          <div style="position:relative;">
            <input class="form-input" type="password" id="current-pwd" required autofocus style="padding-right:40px;" />
            <button type="button" class="btn-toggle-eye" data-target="current-pwd" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;">👁️</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="new-pwd">Nueva Contraseña</label>
          <div style="position:relative;">
            <input class="form-input" type="password" id="new-pwd" minlength="6" required style="padding-right:40px;" />
            <button type="button" class="btn-toggle-eye" data-target="new-pwd" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;">👁️</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="confirm-new-pwd">Confirmar Nueva Contraseña</label>
          <div style="position:relative;">
            <input class="form-input" type="password" id="confirm-new-pwd" minlength="6" required style="padding-right:40px;" />
            <button type="button" class="btn-toggle-eye" data-target="confirm-new-pwd" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;">👁️</button>
          </div>
        </div>

        <button class="btn btn-primary" type="submit" id="btn-submit-change-pwd" style="height: 44px; margin-top: var(--space-2);">
          <span>ACTUALIZAR CONTRASEÑA</span>
        </button>
      </form>
    </div>
  `;

  const errorBox = overlay.querySelector('#change-pwd-error');
  const form = overlay.querySelector('#change-pwd-form');
  const btnClose = overlay.querySelector('#btn-close-change-pwd');
  const submitBtn = overlay.querySelector('#btn-submit-change-pwd');

  function showError(msg) {
    errorBox.style.display = 'block';
    errorBox.textContent = msg;
  }

  function hideError() {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }

  function closeModal() {
    overlay.remove();
  }

  btnClose.addEventListener('click', closeModal);

  overlay.querySelectorAll('.btn-toggle-eye').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = overlay.querySelector(`#${btn.dataset.target}`);
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const currentPassword = overlay.querySelector('#current-pwd').value;
    const newPassword = overlay.querySelector('#new-pwd').value;
    const confirmNewPassword = overlay.querySelector('#confirm-new-pwd').value;

    if (newPassword.length < 6) {
      showError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showError('Las nuevas contraseñas no coinciden');
      return;
    }

    if (currentPassword === newPassword) {
      showError('La nueva contraseña no puede ser igual a la actual');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block"></span>';

    try {
      const resp = await authService.changePassword(currentPassword, newPassword);
      if (resp?.data?.accessToken) {
        localStorage.setItem('ardientes_token', resp.data.accessToken);
      }
      closeModal();
      toast.success(resp.message || 'Contraseña actualizada con éxito');
    } catch (err) {
      showError(err.message || 'Error al cambiar la contraseña');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>ACTUALIZAR CONTRASEÑA</span>';
    }
  });

  document.body.appendChild(overlay);
}

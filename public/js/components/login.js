import { authService } from '../services/auth.service.js';
import { openPasswordResetModal } from './passwordResetModal.js';

export function renderLogin(container, onSuccess, onBack = null) {
  container.innerHTML = `
    <div style="
      position:fixed; inset:0; z-index:9999;
      background: var(--bg-body);
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding: var(--space-4);
      box-sizing: border-box;
      overflow-y: auto;
    ">
      <div class="panel" style="
        width:100%; max-width:400px; padding:var(--space-6); 
        display:flex; flex-direction:column; gap:var(--space-5);
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        box-sizing: border-box;
      ">
        ${onBack ? `
          <button type="button" id="btn-back-to-select" style="
            align-self: flex-start; background: transparent; border: none;
            color: var(--text-secondary); font-size: var(--text-sm); font-weight: 600;
            cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
            padding: 4px 8px; border-radius: var(--radius-sm); margin-bottom: -10px;
          ">
            <span>←</span> <span>Volver a selección</span>
          </button>
        ` : ''}

        <div style="text-align:center;">
          <div style="
            width:80px; height:80px; border-radius:50%;
            background: linear-gradient(135deg,#FF5500,#FF9900);
            display:flex; align-items:center; justify-content:center;
            font-size:2.5rem; margin: 0 auto var(--space-4) auto;
            box-shadow: 0 0 40px rgba(255,85,0,0.3);
          ">🔥</div>
          <h1 style="font-size:var(--text-xl); margin-bottom:var(--space-1)">Ardientes POS</h1>
          <p style="color:var(--text-muted); font-size:var(--text-sm)">Inicia sesión para continuar</p>
        </div>

        <form id="login-form" style="display:flex; flex-direction:column; gap:var(--space-4);">
          <div id="login-error" style="
            display:none; padding:var(--space-2); 
            background: rgba(239, 68, 68, 0.1); color: #EF4444; 
            border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-md);
            font-size: var(--text-sm); text-align:center;
          "></div>

          <div class="form-group">
            <label class="form-label" for="login-identifier">Usuario o Correo</label>
            <input class="form-input" type="text" id="login-identifier" required autofocus autocomplete="username" />
          </div>

          <div class="form-group">
            <label class="form-label" for="login-password">Contraseña</label>
            <input class="form-input" type="password" id="login-password" required autocomplete="current-password" />
          </div>

          <button class="btn btn-primary" type="submit" id="login-btn" style="margin-top:var(--space-2); height: 48px;">
            <span>INGRESAR</span>
          </button>

          <div style="text-align:center; margin-top:var(--space-1);">
            <button type="button" id="btn-forgot-password" style="
              background:none; border:none; color:var(--text-muted);
              font-size:var(--text-sm); cursor:pointer; text-decoration:underline; padding:4px;
            ">
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const errorBox = container.querySelector('#login-error');
  const btn = container.querySelector('#login-btn');
  const identifierInput = container.querySelector('#login-identifier');
  const passwordInput = container.querySelector('#login-password');
  const forgotBtn = container.querySelector('#btn-forgot-password');
  const btnBack = container.querySelector('#btn-back-to-select');

  if (btnBack && typeof onBack === 'function') {
    btnBack.addEventListener('click', () => {
      onBack();
    });
  }

  forgotBtn.addEventListener('click', () => {
    const val = identifierInput.value.trim();
    const initialEmail = val.includes('@') ? val : '';
    openPasswordResetModal(initialEmail);
  });

  const showError = (msg) => {
    errorBox.style.display = 'block';
    errorBox.textContent = msg;
  };

  const hideError = () => {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  };

  const setLoading = (isLoading) => {
    identifierInput.disabled = isLoading;
    passwordInput.disabled = isLoading;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading 
      ? '<span class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block"></span>'
      : '<span>INGRESAR</span>';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const identifier = identifierInput.value.trim();
    const password = passwordInput.value.trim();

    if (!identifier || !password) return;

    setLoading(true);

    try {
      await authService.login(identifier, password);
      // Éxito. Limpiar container y notificar
      container.innerHTML = '';
      if (onSuccess) onSuccess();
    } catch (error) {
      let msg = error.message || 'Error de servidor';
      // Mapeos básicos de errores a español/UI friendly (aunque el backend ya envía mensajes claros)
      if (msg.toLowerCase().includes('inactivo')) {
        msg = 'Usuario inactivo. Contacte al administrador.';
      } else if (msg.toLowerCase().includes('credenciales')) {
        msg = 'Credenciales incorrectas.';
      } else if (msg.toLowerCase().includes('error 401')) {
        msg = 'Credenciales incorrectas.';
      }
      showError(msg);
      passwordInput.value = '';
      passwordInput.focus();
    } finally {
      setLoading(false);
    }
  });
}

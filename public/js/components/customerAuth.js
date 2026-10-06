/**
 * customerAuth.js — Vista de Autenticación de Clientes (Ardientes POS)
 * Permite:
 * 1. Iniciar sesión (teléfono o correo + contraseña).
 * 2. Activar cuenta existente de Caja con código temporal (XXXX-XXXX).
 * 3. Registrarse como cliente totalmente nuevo.
 */
import { customerAuthService } from '../services/customerAuth.service.js';
import { toast } from '../utils/notify.js';

export function renderCustomerAuth(container, { onBack, onSuccess, initialMode = 'login', prefilledPhone = '' } = {}) {
  let currentMode = initialMode; // 'login' | 'activate' | 'register'
  let phoneValue = prefilledPhone;

  function render() {
    container.innerHTML = `
      <div style="
        position: fixed; inset: 0; z-index: 9999;
        background: var(--bg-body, #100A06);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: var(--space-4, 16px);
        box-sizing: border-box;
        overflow-y: auto;
        overflow-x: hidden;
      ">
        <div style="
          width: 100%; max-width: 440px;
          display: flex; flex-direction: column; gap: var(--space-3, 12px);
          box-sizing: border-box; margin: auto;
        ">
          <!-- Botón Volver -->
          <button type="button" id="btn-customer-back" style="
            align-self: flex-start;
            background: transparent; border: none;
            color: var(--text-secondary, #C8A98A); font-size: 0.9rem; font-weight: 600;
            cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
            padding: 8px 10px; border-radius: var(--radius-md, 8px);
            transition: background 150ms ease, color 150ms ease;
          ">
            <span style="font-size: 1.1rem;">←</span>
            <span>Volver a selección</span>
          </button>

          <!-- Tarjeta Principal -->
          <div class="panel" style="
            padding: var(--space-5, 20px);
            background: var(--bg-surface, #1C1008);
            border: 1px solid var(--border-medium, rgba(255, 100, 20, 0.25));
            border-radius: var(--radius-lg, 12px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            display: flex; flex-direction: column; gap: var(--space-4, 16px);
            box-sizing: border-box;
          ">
            <!-- Cabecera de la Marca -->
            <div style="text-align: center;">
              <div style="
                width: 60px; height: 60px; border-radius: 50%;
                background: linear-gradient(135deg, #FF5500, #FF9900);
                display: flex; align-items: center; justify-content: center;
                font-size: 2rem; margin: 0 auto var(--space-2, 8px) auto;
                box-shadow: 0 0 30px rgba(255, 85, 0, 0.35);
              ">🔥</div>
              <h1 style="
                font-family: 'Outfit', sans-serif; font-size: 1.6rem; font-weight: 800;
                color: var(--text-primary, #FFF5EE); letter-spacing: 1.5px; margin: 0 0 4px 0;
              ">ARDIENTES</h1>
              <p style="
                font-family: 'Outfit', sans-serif; font-size: 0.88rem; font-weight: 600;
                color: var(--amber-400, #FFB830); margin: 0; text-transform: uppercase; letter-spacing: 0.5px;
              ">Tu Espacio de Fidelización</p>
            </div>

            <!-- Selector de Pestañas / Modo -->
            <div style="
              display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
              background: rgba(0, 0, 0, 0.35); border-radius: var(--radius-md, 8px);
              padding: 4px; border: 1px solid var(--border-subtle, rgba(255, 100, 20, 0.12));
            ">
              <button type="button" id="tab-login" style="
                height: 40px; border: none; border-radius: 6px; font-weight: 700; font-size: 0.88rem;
                cursor: pointer; transition: all 150ms ease;
                background: ${currentMode === 'login' ? 'var(--fire-500, #FF5500)' : 'transparent'};
                color: ${currentMode === 'login' ? '#FFF5EE' : 'var(--text-secondary, #C8A98A)'};
              ">
                Iniciar Sesión
              </button>
              <button type="button" id="tab-register" style="
                height: 40px; border: none; border-radius: 6px; font-weight: 700; font-size: 0.88rem;
                cursor: pointer; transition: all 150ms ease;
                background: ${currentMode !== 'login' ? 'var(--fire-500, #FF5500)' : 'transparent'};
                color: ${currentMode !== 'login' ? '#FFF5EE' : 'var(--text-secondary, #C8A98A)'};
              ">
                Crear / Activar
              </button>
            </div>

            <!-- Banner Alerta de Error si existe -->
            <div id="auth-error-banner" style="display: none;"></div>

            <!-- Formularios según el modo actual -->
            ${renderFormContent()}
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function renderFormContent() {
    if (currentMode === 'login') {
      return `
        <form id="form-customer-login" style="display: flex; flex-direction: column; gap: var(--space-3, 12px);">
          <div class="form-group">
            <label class="form-label" style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">
              Teléfono o Correo Electrónico
            </label>
            <input type="text" id="login-identifier" class="input"
                   placeholder="Ej: 3159998877 o cliente@correo.com"
                   required autocomplete="username"
                   value="${phoneValue}"
                   style="height: 46px; font-size: 0.95rem; width: 100%; box-sizing: border-box;" />
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">
              Contraseña
            </label>
            <input type="password" id="login-password" class="input"
                   placeholder="Ingresa tu contraseña"
                   required autocomplete="current-password"
                   style="height: 46px; font-size: 0.95rem; width: 100%; box-sizing: border-box;" />
          </div>

          <button type="submit" id="btn-submit-login" class="btn btn-primary" style="
            width: 100%; height: 48px; margin-top: 8px; font-weight: 700; letter-spacing: 0.5px;
            font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 8px;
          ">
            <span>INGRESAR A MI CUENTA</span>
            <span>→</span>
          </button>

          <div style="text-align: center; margin-top: 6px;">
            <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0;">
              ¿Tienes un código entregado en Caja?
              <a href="#" id="link-go-activate" style="color: var(--amber-400); font-weight: 700; text-decoration: none;">
                Activar aquí
              </a>
            </p>
          </div>
        </form>
      `;
    }

    if (currentMode === 'activate') {
      return `
        <!-- Sub-selector dentro de Crear / Activar -->
        <div style="display: flex; gap: 8px; margin-bottom: 2px;">
          <button type="button" id="subtab-activate" class="btn btn-sm" style="
            flex: 1; height: 34px; font-size: 0.78rem; font-weight: 700;
            background: rgba(255, 100, 20, 0.2); border: 1px solid var(--fire-500); color: var(--text-primary);
          ">
            🎟️ Con Código de Caja
          </button>
          <button type="button" id="subtab-register" class="btn btn-sm btn-ghost" style="
            flex: 1; height: 34px; font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);
          ">
            👤 Cliente Nuevo
          </button>
        </div>

        <div style="
          background: rgba(255, 165, 0, 0.08); border: 1px solid rgba(255, 165, 0, 0.25);
          border-radius: var(--radius-md, 8px); padding: 10px 12px; font-size: 0.82rem;
          color: var(--amber-300, #FFD166); line-height: 1.4;
        ">
          💡 <strong>¿Ya compraste en nuestro restaurante?</strong> Activa tu cuenta con el código temporal entregado en Caja para vincular y conservar todos tus puntos.
        </div>

        <form id="form-customer-activate" style="display: flex; flex-direction: column; gap: var(--space-3, 12px);">
          <div class="form-group">
            <label class="form-label" style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">
              Teléfono registrado en Caja *
            </label>
            <input type="tel" id="act-phone" class="input"
                   placeholder="Ej: 3159998877"
                   required autocomplete="tel"
                   value="${phoneValue}"
                   style="height: 46px; font-size: 0.95rem; width: 100%; box-sizing: border-box;" />
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">
              Código de Activación (de Caja) *
            </label>
            <input type="text" id="act-code" class="input"
                   placeholder="Ej: C7K9-W2M4"
                   required maxlength="12"
                   style="
                     height: 46px; font-size: 1.15rem; font-family: monospace; font-weight: 800;
                     text-align: center; text-transform: uppercase; letter-spacing: 2px;
                     color: var(--amber-400); width: 100%; box-sizing: border-box;
                   " />
            <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
              Código de 8 caracteres alfanuméricos. Válido por 24 horas.
            </span>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">
              Crea tu Contraseña *
            </label>
            <input type="password" id="act-password" class="input"
                   placeholder="Mínimo 6 caracteres"
                   required minlength="6" autocomplete="new-password"
                   style="height: 46px; font-size: 0.95rem; width: 100%; box-sizing: border-box;" />
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">
              Correo Electrónico (Opcional)
            </label>
            <input type="email" id="act-email" class="input"
                   placeholder="cliente@correo.com"
                   autocomplete="email"
                   style="height: 46px; font-size: 0.95rem; width: 100%; box-sizing: border-box;" />
          </div>

          <button type="submit" id="btn-submit-activate" class="btn btn-primary" style="
            width: 100%; height: 48px; margin-top: 6px; font-weight: 700; letter-spacing: 0.5px;
            font-size: 0.92rem; display: flex; align-items: center; justify-content: center; gap: 8px;
          ">
            <span>ACTIVAR Y CONSERVAR MIS PUNTOS</span>
            <span>🔥</span>
          </button>
        </form>
      `;
    }

    // currentMode === 'register'
    return `
      <!-- Sub-selector dentro de Crear / Activar -->
      <div style="display: flex; gap: 8px; margin-bottom: 2px;">
        <button type="button" id="subtab-activate" class="btn btn-sm btn-ghost" style="
          flex: 1; height: 34px; font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);
        ">
          🎟️ Con Código de Caja
        </button>
        <button type="button" id="subtab-register" class="btn btn-sm" style="
          flex: 1; height: 34px; font-size: 0.78rem; font-weight: 700;
          background: rgba(255, 100, 20, 0.2); border: 1px solid var(--fire-500); color: var(--text-primary);
        ">
          👤 Cliente Nuevo
        </button>
      </div>

      <form id="form-customer-register" style="display: flex; flex-direction: column; gap: var(--space-3, 12px);">
        <div class="form-group">
          <label class="form-label" style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">
            Nombre Completo *
          </label>
          <input type="text" id="reg-name" class="input"
                 placeholder="Ej: Camila Torres"
                 required minlength="2" autocomplete="name"
                 style="height: 46px; font-size: 0.95rem; width: 100%; box-sizing: border-box;" />
        </div>

        <div class="form-group">
          <label class="form-label" style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">
            Teléfono Móvil *
          </label>
          <input type="tel" id="reg-phone" class="input"
                 placeholder="Ej: 3201112233"
                 required autocomplete="tel"
                 value="${phoneValue}"
                 style="height: 46px; font-size: 0.95rem; width: 100%; box-sizing: border-box;" />
        </div>

        <div class="form-group">
          <label class="form-label" style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">
            Correo Electrónico *
          </label>
          <input type="email" id="reg-email" class="input"
                 placeholder="cliente@correo.com"
                 required autocomplete="email"
                 style="height: 46px; font-size: 0.95rem; width: 100%; box-sizing: border-box;" />
        </div>

        <div class="form-group">
          <label class="form-label" style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">
            Contraseña *
          </label>
          <input type="password" id="reg-password" class="input"
                 placeholder="Mínimo 6 caracteres"
                 required minlength="6" autocomplete="new-password"
                 style="height: 46px; font-size: 0.95rem; width: 100%; box-sizing: border-box;" />
        </div>

        <button type="submit" id="btn-submit-register" class="btn btn-primary" style="
          width: 100%; height: 48px; margin-top: 6px; font-weight: 700; letter-spacing: 0.5px;
          font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 8px;
        ">
          <span>CREAR CUENTA NUEVA</span>
          <span>→</span>
        </button>
      </form>
    `;
  }

  function showError(message, { showActivateSuggestion = false, suggestionPhone = '' } = {}) {
    const banner = container.querySelector('#auth-error-banner');
    if (!banner) return;

    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="
        background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4);
        border-radius: var(--radius-md, 8px); padding: 12px;
        color: #FFA5A5; font-size: 0.84rem; line-height: 1.4;
      ">
        <div style="display: flex; gap: 8px; align-items: flex-start;">
          <span style="font-size: 1.1rem; line-height: 1;">⚠️</span>
          <div style="flex: 1;">
            <p style="margin: 0 0 ${showActivateSuggestion ? '8px' : '0'} 0;">${message}</p>
            ${showActivateSuggestion ? `
              <button type="button" id="btn-banner-switch-activate" class="btn btn-sm" style="
                background: var(--amber-500, #F59E0B); color: #100A06; font-weight: 800;
                border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer;
              ">
                🎟️ Activar con Código de Caja
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    if (showActivateSuggestion) {
      const switchBtn = banner.querySelector('#btn-banner-switch-activate');
      if (switchBtn) {
        switchBtn.addEventListener('click', () => {
          currentMode = 'activate';
          if (suggestionPhone) phoneValue = suggestionPhone;
          render();
        });
      }
    }
  }

  function hideError() {
    const banner = container.querySelector('#auth-error-banner');
    if (banner) {
      banner.style.display = 'none';
      banner.innerHTML = '';
    }
  }

  function bindEvents() {
    // Botón volver
    const backBtn = container.querySelector('#btn-customer-back');
    if (backBtn && onBack) {
      backBtn.addEventListener('click', onBack);
    }

    // Pestañas principales
    const tabLogin = container.querySelector('#tab-login');
    const tabRegister = container.querySelector('#tab-register');

    if (tabLogin) {
      tabLogin.addEventListener('click', () => {
        if (currentMode !== 'login') {
          currentMode = 'login';
          render();
        }
      });
    }

    if (tabRegister) {
      tabRegister.addEventListener('click', () => {
        if (currentMode === 'login') {
          currentMode = 'activate';
          render();
        }
      });
    }

    // Enlace "¿Tienes un código entregado en Caja?" en login
    const linkActivate = container.querySelector('#link-go-activate');
    if (linkActivate) {
      linkActivate.addEventListener('click', (e) => {
        e.preventDefault();
        currentMode = 'activate';
        render();
      });
    }

    // Sub-pestañas dentro de Crear / Activar
    const subtabActivate = container.querySelector('#subtab-activate');
    const subtabRegister = container.querySelector('#subtab-register');

    if (subtabActivate) {
      subtabActivate.addEventListener('click', () => {
        if (currentMode !== 'activate') {
          currentMode = 'activate';
          render();
        }
      });
    }

    if (subtabRegister) {
      subtabRegister.addEventListener('click', () => {
        if (currentMode !== 'register') {
          currentMode = 'register';
          render();
        }
      });
    }

    // Formulario Login
    const formLogin = container.querySelector('#form-customer-login');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        const identifier = container.querySelector('#login-identifier')?.value.trim();
        const password = container.querySelector('#login-password')?.value;
        const submitBtn = container.querySelector('#btn-submit-login');

        if (!identifier || !password) return;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;"></span> Verificando...';

        try {
          const customer = await customerAuthService.login(identifier, password);
          toast.success(`¡Bienvenido de nuevo, ${customer.fullName}!`);
          if (onSuccess) onSuccess(customer);
        } catch (err) {
          showError(err.message || 'Error al iniciar sesión');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>INGRESAR A MI CUENTA</span><span>→</span>';
        }
      });
    }

    // Formulario Activación
    const formActivate = container.querySelector('#form-customer-activate');
    if (formActivate) {
      // Autoformatear código alfanumérico a mayúsculas
      const codeInput = container.querySelector('#act-code');
      if (codeInput) {
        codeInput.addEventListener('input', () => {
          codeInput.value = codeInput.value.toUpperCase();
        });
      }

      formActivate.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        const phone = container.querySelector('#act-phone')?.value.trim();
        const code = container.querySelector('#act-code')?.value.trim();
        const password = container.querySelector('#act-password')?.value;
        const email = container.querySelector('#act-email')?.value.trim();
        const submitBtn = container.querySelector('#btn-submit-activate');

        if (!phone || !code || !password) return;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;"></span> Activando cuenta...';

        try {
          const customer = await customerAuthService.activate({
            phone,
            activationCode: code,
            password,
            email,
          });
          toast.success(`¡Cuenta activada con éxito! Conservas tus puntos de fidelización.`);
          if (onSuccess) onSuccess(customer);
        } catch (err) {
          showError(err.message || 'Error al activar cuenta');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>ACTIVAR Y CONSERVAR MIS PUNTOS</span><span>🔥</span>';
        }
      });
    }

    // Formulario Registro Nuevo
    const formRegister = container.querySelector('#form-customer-register');
    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        const fullName = container.querySelector('#reg-name')?.value.trim();
        const phone = container.querySelector('#reg-phone')?.value.trim();
        const email = container.querySelector('#reg-email')?.value.trim();
        const password = container.querySelector('#reg-password')?.value;
        const submitBtn = container.querySelector('#btn-submit-register');

        if (!fullName || !phone || !email || !password) return;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;"></span> Creando cuenta...';

        try {
          const customer = await customerAuthService.register({
            fullName,
            phone,
            email,
            password,
          });
          toast.success(`¡Bienvenido a Ardientes, ${customer.fullName}!`);
          if (onSuccess) onSuccess(customer);
        } catch (err) {
          const isRegisteredInPos = err.message && err.message.toLowerCase().includes('registrado en nuestro punto de venta');
          showError(err.message || 'Error al registrar cliente', {
            showActivateSuggestion: isRegisteredInPos,
            suggestionPhone: phone,
          });
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>CREAR CUENTA NUEVA</span><span>→</span>';
        }
      });
    }
  }

  render();
}

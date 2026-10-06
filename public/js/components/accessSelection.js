/**
 * accessSelection.js — Pantalla de selección de acceso inicial
 * Permite al usuario elegir entre el acceso de Colaborador (POS interno)
 * y el acceso de Cliente (Portal de Clientes).
 */

export function renderAccessSelection(container, { onSelectStaff, onSelectCustomer } = {}) {
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
        width: 100%; max-width: 420px;
        display: flex; flex-direction: column; gap: var(--space-5, 20px);
        box-sizing: border-box;
      ">
        <!-- Cabecera de la marca -->
        <div style="text-align: center;">
          <div style="
            width: 72px; height: 72px; border-radius: 50%;
            background: linear-gradient(135deg, #FF5500, #FF9900);
            display: flex; align-items: center; justify-content: center;
            font-size: 2.25rem; margin: 0 auto var(--space-3, 12px) auto;
            box-shadow: 0 0 35px rgba(255, 85, 0, 0.4);
          ">🔥</div>
          <h1 style="
            font-family: 'Outfit', sans-serif; font-size: 1.85rem; font-weight: 800;
            color: var(--text-primary, #FFF5EE); letter-spacing: 1.5px; margin: 0 0 4px 0;
          ">ARDIENTES</h1>
          <p style="
            font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 600;
            color: var(--text-secondary, #C8A98A); margin: 0;
          ">¿Cómo deseas ingresar?</p>
        </div>

        <!-- Tarjetas de selección -->
        <div style="display: flex; flex-direction: column; gap: var(--space-4, 16px); width: 100%; box-sizing: border-box;">
          
          <!-- Opción 1: Colaborador -->
          <div class="panel" id="card-select-staff" style="
            padding: var(--space-5, 20px);
            background: var(--bg-surface, #1C1008);
            border: 1px solid var(--border-medium, rgba(255, 100, 20, 0.25));
            border-radius: var(--radius-lg, 12px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
            display: flex; flex-direction: column; gap: var(--space-3, 12px);
            cursor: pointer;
            transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
            box-sizing: border-box;
          ">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="
                width: 48px; height: 48px; border-radius: 12px;
                background: rgba(255, 85, 0, 0.12);
                border: 1px solid rgba(255, 85, 0, 0.25);
                display: flex; align-items: center; justify-content: center;
                font-size: 1.6rem; flex-shrink: 0;
              ">👨‍💼</div>
              <div style="flex: 1; min-width: 0;">
                <h2 style="
                  font-size: 1.1rem; font-weight: 700; margin: 0 0 2px 0;
                  color: var(--text-primary, #FFF5EE);
                ">COLABORADOR</h2>
                <p style="
                  font-size: 0.8rem; color: var(--text-fire, #FF7733);
                  font-weight: 600; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;
                ">Acceso al sistema interno</p>
              </div>
            </div>

            <p style="
              font-size: 0.85rem; color: var(--text-secondary, #C8A98A);
              margin: 0; line-height: 1.4;
            ">
              Caja · Mesero · Cocina · Administración
            </p>

            <button class="btn btn-primary" type="button" id="btn-enter-staff" style="
              width: 100%; height: 48px; margin-top: 4px;
              font-weight: 700; letter-spacing: 0.5px;
              display: flex; align-items: center; justify-content: center; gap: 8px;
            ">
              <span>INGRESAR COMO COLABORADOR</span>
              <span style="font-size: 1.1rem;">→</span>
            </button>
          </div>

          <!-- Opción 2: Cliente -->
          <div class="panel" id="card-select-customer" style="
            padding: var(--space-5, 20px);
            background: var(--bg-surface, #1C1008);
            border: 1px solid var(--border-subtle, rgba(255, 100, 20, 0.15));
            border-radius: var(--radius-lg, 12px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
            display: flex; flex-direction: column; gap: var(--space-3, 12px);
            cursor: pointer;
            transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
            box-sizing: border-box;
          ">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="
                width: 48px; height: 48px; border-radius: 12px;
                background: rgba(255, 184, 48, 0.12);
                border: 1px solid rgba(255, 184, 48, 0.25);
                display: flex; align-items: center; justify-content: center;
                font-size: 1.6rem; flex-shrink: 0;
              ">🧑</div>
              <div style="flex: 1; min-width: 0;">
                <h2 style="
                  font-size: 1.1rem; font-weight: 700; margin: 0 0 2px 0;
                  color: var(--text-primary, #FFF5EE);
                ">CLIENTE</h2>
                <p style="
                  font-size: 0.8rem; color: var(--amber-400, #FFB830);
                  font-weight: 600; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;
                ">Tu espacio en Ardientes</p>
              </div>
            </div>

            <p style="
              font-size: 0.85rem; color: var(--text-secondary, #C8A98A);
              margin: 0; line-height: 1.4;
            ">
              Pedidos · Puntos · Beneficios · Historial
            </p>

            <button class="btn btn-secondary" type="button" id="btn-enter-customer" style="
              width: 100%; height: 48px; margin-top: 4px;
              border-color: rgba(255, 184, 48, 0.35);
              color: var(--text-primary, #FFF5EE);
              font-weight: 700; letter-spacing: 0.5px;
              display: flex; align-items: center; justify-content: center; gap: 8px;
            ">
              <span>INGRESAR COMO CLIENTE</span>
              <span style="font-size: 1.1rem;">→</span>
            </button>
          </div>

        </div>

        <!-- Pie de página discreto -->
        <p style="
          text-align: center; font-size: 0.75rem; color: var(--text-muted, #7A5A45);
          margin: 0;
        ">
          Ardientes Comidas Rápidas · Punto de Venta & Portal
        </p>
      </div>
    </div>
  `;

  // Interacción táctil / hover en tarjetas
  const staffCard = container.querySelector('#card-select-staff');
  const customerCard = container.querySelector('#card-select-customer');
  const btnStaff = container.querySelector('#btn-enter-staff');
  const btnCustomer = container.querySelector('#btn-enter-customer');

  const handleSelectStaff = () => {
    if (typeof onSelectStaff === 'function') {
      onSelectStaff();
    }
  };

  const handleSelectCustomer = () => {
    if (typeof onSelectCustomer === 'function') {
      onSelectCustomer();
    }
  };

  if (staffCard) {
    staffCard.addEventListener('click', (e) => {
      // Evita doble disparo si se hace click directamente en el botón
      if (e.target.closest('#btn-enter-staff')) return;
      handleSelectStaff();
    });
  }
  if (btnStaff) {
    btnStaff.addEventListener('click', handleSelectStaff);
  }

  if (customerCard) {
    customerCard.addEventListener('click', (e) => {
      if (e.target.closest('#btn-enter-customer')) return;
      handleSelectCustomer();
    });
  }
  if (btnCustomer) {
    btnCustomer.addEventListener('click', handleSelectCustomer);
  }
}

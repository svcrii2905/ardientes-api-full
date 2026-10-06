/**
 * customerPortalPlaceholder.js — Pantalla preliminar del Portal de Clientes
 * Informa al cliente sobre las funcionalidades próximas y permite regresar
 * a la pantalla de selección de acceso.
 */

export function renderCustomerPortalPlaceholder(container, { onBack } = {}) {
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
        display: flex; flex-direction: column; gap: var(--space-4, 16px);
        box-sizing: border-box;
      ">
        <!-- Botón Volver superior -->
        <button type="button" id="btn-customer-back-top" style="
          align-self: flex-start;
          background: transparent; border: none;
          color: var(--text-secondary, #C8A98A); font-size: 0.9rem; font-weight: 600;
          cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 12px; border-radius: var(--radius-md, 8px);
          transition: background 150ms ease, color 150ms ease;
        ">
          <span style="font-size: 1.1rem;">←</span>
          <span>Volver a selección</span>
        </button>

        <div class="panel" style="
          padding: var(--space-6, 24px);
          background: var(--bg-surface, #1C1008);
          border: 1px solid var(--border-medium, rgba(255, 100, 20, 0.25));
          border-radius: var(--radius-lg, 12px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          display: flex; flex-direction: column; gap: var(--space-5, 20px);
          box-sizing: border-box;
        ">
          <!-- Cabecera -->
          <div style="text-align: center;">
            <div style="
              width: 72px; height: 72px; border-radius: 50%;
              background: linear-gradient(135deg, #FFA500, #FF5500);
              display: flex; align-items: center; justify-content: center;
              font-size: 2.25rem; margin: 0 auto var(--space-3, 12px) auto;
              box-shadow: 0 0 35px rgba(255, 165, 0, 0.35);
            ">🧑</div>
            <h1 style="
              font-family: 'Outfit', sans-serif; font-size: 1.45rem; font-weight: 800;
              color: var(--text-primary, #FFF5EE); letter-spacing: 1px; margin: 0 0 6px 0;
            ">TU ESPACIO ARDIENTES</h1>
            <p style="
              font-size: 0.88rem; color: var(--amber-400, #FFB830);
              font-weight: 600; margin: 0;
            ">Portal de Clientes · Próximamente</p>
          </div>

          <!-- Mensaje y lista de funcionalidades futuras -->
          <div style="
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--border-subtle, rgba(255, 100, 20, 0.12));
            border-radius: var(--radius-md, 8px);
            padding: var(--space-4, 16px);
            display: flex; flex-direction: column; gap: var(--space-3, 12px);
          ">
            <p style="
              font-size: 0.9rem; font-weight: 700; color: var(--text-primary, #FFF5EE);
              margin: 0;
            ">
              Próximamente podrás:
            </p>

            <ul style="
              list-style: none; margin: 0; padding: 0;
              display: flex; flex-direction: column; gap: 10px;
            ">
              <li style="display: flex; align-items: flex-start; gap: 10px; font-size: 0.86rem; color: var(--text-secondary, #C8A98A);">
                <span style="font-size: 1.1rem; line-height: 1;">🛍️</span>
                <span><strong>Consultar tus pedidos:</strong> Seguimiento en vivo de tu orden.</span>
              </li>
              <li style="display: flex; align-items: flex-start; gap: 10px; font-size: 0.86rem; color: var(--text-secondary, #C8A98A);">
                <span style="font-size: 1.1rem; line-height: 1;">⭐</span>
                <span><strong>Ver tus puntos:</strong> Acumula y canjea hamburguesas gratis.</span>
              </li>
              <li style="display: flex; align-items: flex-start; gap: 10px; font-size: 0.86rem; color: var(--text-secondary, #C8A98A);">
                <span style="font-size: 1.1rem; line-height: 1;">🎁</span>
                <span><strong>Consultar beneficios:</strong> Promociones exclusivas para clientes.</span>
              </li>
              <li style="display: flex; align-items: flex-start; gap: 10px; font-size: 0.86rem; color: var(--text-secondary, #C8A98A);">
                <span style="font-size: 1.1rem; line-height: 1;">📜</span>
                <span><strong>Revisar tu historial:</strong> Consulta tus consumos pasados.</span>
              </li>
              <li style="display: flex; align-items: flex-start; gap: 10px; font-size: 0.86rem; color: var(--text-secondary, #C8A98A);">
                <span style="font-size: 1.1rem; line-height: 1;">⚙️</span>
                <span><strong>Gestionar tus datos:</strong> Actualiza tu teléfono y dirección.</span>
              </li>
            </ul>
          </div>

          <!-- Botón de acción Volver -->
          <button class="btn btn-primary" type="button" id="btn-customer-back" style="
            width: 100%; height: 48px; font-weight: 700; letter-spacing: 0.5px;
            display: flex; align-items: center; justify-content: center; gap: 8px;
          ">
            <span>← VOLVER A SELECCIÓN</span>
          </button>
        </div>

        <p style="
          text-align: center; font-size: 0.75rem; color: var(--text-muted, #7A5A45);
          margin: 0;
        ">
          Ardientes Comidas Rápidas · Muy pronto disponible para ti
        </p>
      </div>
    </div>
  `;

  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
    }
  };

  const btnTop = container.querySelector('#btn-customer-back-top');
  const btnBottom = container.querySelector('#btn-customer-back');

  if (btnTop) btnTop.addEventListener('click', handleBack);
  if (btnBottom) btnBottom.addEventListener('click', handleBack);
}

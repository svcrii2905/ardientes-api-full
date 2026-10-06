/**
 * inventory.js — Módulo de Gestión de Inventario para Ardientes POS
 * Conecta con los endpoints reales:
 * - GET  /api/v1/inventory/items
 * - GET  /api/v1/inventory/items/low-stock
 * - POST /api/v1/inventory/movements
 * - GET  /api/v1/inventory/movements
 */
import { inventoryService } from '../services/inventory.service.js';
import { formatCurrency } from '../utils/currency.js';
import { toast } from '../utils/notify.js';

let currentItems = [];
let currentMovements = [];
let currentTab = 'inventory'; // 'inventory' | 'alerts' | 'history'
let searchQuery = '';
let historyItemFilter = '';

export async function renderInventory(container) {
  container.innerHTML = `
    <div class="page-layout">
      <div class="page-header" style="flex-wrap:wrap;gap:var(--space-3)">
        <div>
          <h1 class="page-title">📦 Inventario</h1>
          <p style="color:var(--text-muted);font-size:var(--text-sm);margin-top:2px">
            Control de insumos, alertas de reposición y movimientos
          </p>
        </div>
        <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" id="btn-refresh-inv">
            🔄 Actualizar
          </button>
          <button class="btn btn-primary btn-sm" id="btn-open-movement-modal">
            ➕ Registrar Movimiento
          </button>
        </div>
      </div>

      <div class="page-body" id="inventory-body">
        <div style="text-align:center;padding:var(--space-10);color:var(--text-muted)">
          <div class="spinner" style="margin:0 auto var(--space-4)"></div>
          Cargando datos de inventario...
        </div>
      </div>
    </div>
  `;

  // Event Listeners principales
  container.querySelector('#btn-refresh-inv')?.addEventListener('click', () => loadInventoryData(container));
  container.querySelector('#btn-open-movement-modal')?.addEventListener('click', () => openMovementModal(container));

  await loadInventoryData(container);
}

/** Carga los datos desde la API */
async function loadInventoryData(container) {
  const body = container.querySelector('#inventory-body');
  if (!body) return;

  try {
    const [items, movements] = await Promise.all([
      inventoryService.getItems(),
      inventoryService.getMovements({ limit: 100 }),
    ]);

    currentItems = items;
    currentMovements = movements;

    renderInventoryContent(container);
  } catch (error) {
    body.innerHTML = `
      <div class="empty-state" style="max-width:500px;margin:var(--space-8) auto;text-align:center">
        <div style="font-size:3.5rem;margin-bottom:var(--space-3)">⚠️</div>
        <h2 style="color:var(--text-primary);margin-bottom:var(--space-2)">No se pudo conectar con el inventario</h2>
        <p style="color:var(--text-muted);font-size:var(--text-sm);line-height:1.6;margin-bottom:var(--space-5)">
          Ocurrió un error al obtener la información desde el servidor backend: <br>
          <code style="color:var(--fire-300);font-size:var(--text-xs)">${error.message || error}</code>
        </p>
        <button class="btn btn-primary btn-sm" id="btn-retry-inv">
          🔄 Reintentar Conexión
        </button>
      </div>
    `;

    container.querySelector('#btn-retry-inv')?.addEventListener('click', () => loadInventoryData(container));
  }
}

/** Renderiza el contenido principal con resumen, tabs y tablas */
function renderInventoryContent(container) {
  const body = container.querySelector('#inventory-body');
  if (!body) return;

  // Cálculos para el Resumen Superior
  const totalItems = currentItems.length;
  const outOfStockItems = currentItems.filter(i => i.currentStock <= 0);
  const lowStockItems = currentItems.filter(i => i.currentStock > 0 && i.currentStock <= i.minStock);
  const normalStockCount = totalItems - outOfStockItems.length - lowStockItems.length;
  const totalInventoryValue = currentItems.reduce((sum, item) => sum + (item.currentStock * item.costPerUnit), 0);

  body.innerHTML = `
    <!-- 1. RESUMEN SUPERIOR KPI -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:var(--space-4);margin-bottom:var(--space-6)">
      <div class="panel" style="display:flex;align-items:center;gap:var(--space-4);padding:var(--space-4)">
        <div style="font-size:2.2rem;background:rgba(255,119,51,0.1);width:52px;height:52px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center">📦</div>
        <div>
          <p style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600">TOTAL INSUMOS</p>
          <p style="font-size:var(--text-2xl);font-weight:800;color:var(--text-primary);margin-top:2px">${totalItems}</p>
        </div>
      </div>

      <div class="panel" style="display:flex;align-items:center;gap:var(--space-4);padding:var(--space-4)">
        <div style="font-size:2.2rem;background:rgba(16,185,129,0.1);width:52px;height:52px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center">🟢</div>
        <div>
          <p style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600">STOCK NORMAL</p>
          <p style="font-size:var(--text-2xl);font-weight:800;color:var(--status-online);margin-top:2px">${normalStockCount}</p>
        </div>
      </div>

      <div class="panel" style="display:flex;align-items:center;gap:var(--space-4);padding:var(--space-4)">
        <div style="font-size:2.2rem;background:rgba(245,158,11,0.1);width:52px;height:52px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center">🟡</div>
        <div>
          <p style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600">STOCK BAJO</p>
          <p style="font-size:var(--text-2xl);font-weight:800;color:var(--amber-500);margin-top:2px">${lowStockItems.length}</p>
        </div>
      </div>

      <div class="panel" style="display:flex;align-items:center;gap:var(--space-4);padding:var(--space-4)">
        <div style="font-size:2.2rem;background:rgba(239,68,68,0.1);width:52px;height:52px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center">🔴</div>
        <div>
          <p style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600">AGOTADOS</p>
          <p style="font-size:var(--text-2xl);font-weight:800;color:var(--status-offline);margin-top:2px">${outOfStockItems.length}</p>
        </div>
      </div>

      <div class="panel" style="display:flex;align-items:center;gap:var(--space-4);padding:var(--space-4)">
        <div style="font-size:2.2rem;background:rgba(255,184,48,0.1);width:52px;height:52px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center">💰</div>
        <div>
          <p style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600">VALOR INVENTARIO</p>
          <p style="font-size:var(--text-xl);font-weight:800;color:var(--gold-400);margin-top:2px">${formatCurrency(totalInventoryValue)}</p>
        </div>
      </div>
    </div>

    <!-- TABS DE NAVEGACIÓN -->
    <div style="display:flex;gap:var(--space-2);border-bottom:1.5px solid var(--border-subtle);margin-bottom:var(--space-5)">
      <button class="inv-tab-btn ${currentTab === 'inventory' ? 'active' : ''}" data-tab="inventory">
        📋 Inventario Actual (${totalItems})
      </button>
      <button class="inv-tab-btn ${currentTab === 'alerts' ? 'active' : ''}" data-tab="alerts">
        ⚠️ Alertas de Stock (${lowStockItems.length + outOfStockItems.length})
      </button>
      <button class="inv-tab-btn ${currentTab === 'history' ? 'active' : ''}" data-tab="history">
        📜 Historial de Movimientos (${currentMovements.length})
      </button>
    </div>

    <!-- VISTA SEGÚN TAB ACTIVA -->
    <div id="inv-tab-content"></div>
  `;

  // Estilos inline de tabs si se requiere o listeners
  const tabs = body.querySelectorAll('.inv-tab-btn');
  tabs.forEach(tabBtn => {
    tabBtn.addEventListener('click', (e) => {
      currentTab = e.currentTarget.dataset.tab;
      renderInventoryContent(container);
    });
  });

  const tabContainer = body.querySelector('#inv-tab-content');
  if (currentTab === 'inventory') {
    renderInventoryTab(tabContainer, container);
  } else if (currentTab === 'alerts') {
    renderAlertsTab(tabContainer, container, lowStockItems, outOfStockItems);
  } else if (currentTab === 'history') {
    renderHistoryTab(tabContainer);
  }
}

/** 📊 TAB 1: LISTA DE INVENTARIO Y BÚSQUEDA */
function renderInventoryTab(tabContainer, container) {
  const filteredItems = currentItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.unit.toLowerCase().includes(searchQuery.toLowerCase())
  );

  tabContainer.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4);gap:var(--space-4);flex-wrap:wrap">
      <div style="position:relative;flex:1;max-width:360px">
        <input class="input" id="inv-search-input" type="text" placeholder="🔍 Buscar por insumo o unidad..." value="${searchQuery}" style="width:100%" />
      </div>
      <p style="color:var(--text-muted);font-size:var(--text-xs)">
        Mostrando ${filteredItems.length} de ${currentItems.length} insumos
      </p>
    </div>

    ${filteredItems.length === 0 ? `
      <div class="empty-state" style="padding:var(--space-8)">
        <div class="empty-icon">🔍</div>
        <p>No se encontraron insumos que coincidan con "${searchQuery}"</p>
      </div>
    ` : `
      <div class="panel" style="padding:0;overflow-x:auto">
        <table class="data-table" style="width:100%">
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Unidad</th>
              <th>Stock Actual</th>
              <th>Stock Mínimo</th>
              <th>Costo Unit.</th>
              <th>Valor Total</th>
              <th>Estado</th>
              <th style="text-align:right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map(item => {
              let badgeHtml = `<span class="badge badge-green">🟢 Normal</span>`;
              if (item.currentStock <= 0) {
                badgeHtml = `<span class="badge badge-red">🔴 Agotado</span>`;
              } else if (item.currentStock <= item.minStock) {
                badgeHtml = `<span class="badge badge-amber">🟡 Stock bajo</span>`;
              }

              const stockValue = item.currentStock * item.costPerUnit;

              return `
                <tr>
                  <td><strong>${item.name}</strong></td>
                  <td><code style="font-size:var(--text-xs);color:var(--text-secondary)">${item.unit}</code></td>
                  <td>
                    <span style="font-weight:700;font-size:var(--text-base);color:${item.currentStock <= item.minStock ? 'var(--fire-300)' : 'var(--text-primary)'}">
                      ${formatQuantity(item.currentStock)}
                    </span>
                  </td>
                  <td style="color:var(--text-muted)">${formatQuantity(item.minStock)}</td>
                  <td>${formatCurrency(item.costPerUnit)}</td>
                  <td style="color:var(--gold-400);font-weight:600">${formatCurrency(stockValue)}</td>
                  <td>${badgeHtml}</td>
                  <td style="text-align:right">
                    <button class="btn btn-secondary btn-icon-sm btn-quick-mov" data-id="${item.id}" data-type="ENTRADA" title="Registrar Entrada">
                      📥
                    </button>
                    <button class="btn btn-secondary btn-icon-sm btn-quick-mov" data-id="${item.id}" data-type="SALIDA" title="Registrar Salida">
                      📤
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;

  // Search input listener
  const searchInput = tabContainer.querySelector('#inv-search-input');
  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderInventoryTab(tabContainer, container);
  });

  // Quick movement button listener
  tabContainer.querySelectorAll('.btn-quick-mov').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemId = Number(e.currentTarget.dataset.id);
      const movType = e.currentTarget.dataset.type;
      openMovementModal(container, itemId, movType);
    });
  });
}

/** ⚠️ TAB 2: ALERTAS DE STOCK BAJO Y AGOTADOS */
function renderAlertsTab(tabContainer, container, lowStockItems, outOfStockItems) {
  tabContainer.innerHTML = `
    <!-- SECCIÓN 1: 🚨 AGOTADOS -->
    <div style="margin-bottom:var(--space-6)">
      <h3 style="font-size:var(--text-lg);font-weight:700;color:#F87171;margin-bottom:var(--space-3);display:flex;align-items:center;gap:var(--space-2)">
        🚨 Insumos Agotados (${outOfStockItems.length})
      </h3>
      ${outOfStockItems.length === 0 ? `
        <div class="panel" style="padding:var(--space-4);color:var(--text-muted);font-size:var(--text-sm)">
          ✅ Ningún insumo se encuentra completamente agotado.
        </div>
      ` : `
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:var(--space-4)">
          ${outOfStockItems.map(item => `
            <div class="panel" style="border-left:4px solid #EF4444;display:flex;flex-direction:column;justify-content:space-between;gap:var(--space-3)">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <h4 style="font-size:var(--text-base);font-weight:700">${item.name}</h4>
                  <span class="badge badge-red">🔴 Agotado</span>
                </div>
                <p style="color:var(--text-muted);font-size:var(--text-xs);margin-top:var(--space-1)">
                  Proveedor: ${item.supplier || 'No especificado'}
                </p>
                <div style="margin-top:var(--space-3);display:flex;gap:var(--space-4);font-size:var(--text-sm)">
                  <div>
                    <span style="color:var(--text-muted);display:block;font-size:var(--text-xs)">Stock Actual</span>
                    <span style="color:#EF4444;font-weight:800">0 ${item.unit}</span>
                  </div>
                  <div>
                    <span style="color:var(--text-muted);display:block;font-size:var(--text-xs)">Mínimo Requerido</span>
                    <span style="font-weight:600">${formatQuantity(item.minStock)} ${item.unit}</span>
                  </div>
                </div>
              </div>
              <button class="btn btn-primary btn-sm btn-reponer" data-id="${item.id}" style="width:100%;margin-top:var(--space-2)">
                📥 Registrar Reposición
              </button>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <!-- SECCIÓN 2: ⚠️ STOCK BAJO -->
    <div>
      <h3 style="font-size:var(--text-lg);font-weight:700;color:var(--amber-500);margin-bottom:var(--space-3);display:flex;align-items:center;gap:var(--space-2)">
        ⚠️ Insumos con Stock Bajo (${lowStockItems.length})
      </h3>
      ${lowStockItems.length === 0 ? `
        <div class="panel" style="padding:var(--space-4);color:var(--text-muted);font-size:var(--text-sm)">
          ✅ Todos los insumos disponibles superan el nivel mínimo establecido.
        </div>
      ` : `
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:var(--space-4)">
          ${lowStockItems.map(item => `
            <div class="panel" style="border-left:4px solid var(--amber-500);display:flex;flex-direction:column;justify-content:space-between;gap:var(--space-3)">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <h4 style="font-size:var(--text-base);font-weight:700">${item.name}</h4>
                  <span class="badge badge-amber">🟡 Stock bajo</span>
                </div>
                <p style="color:var(--text-muted);font-size:var(--text-xs);margin-top:var(--space-1)">
                  Proveedor: ${item.supplier || 'No especificado'}
                </p>
                <div style="margin-top:var(--space-3);display:flex;gap:var(--space-4);font-size:var(--text-sm)">
                  <div>
                    <span style="color:var(--text-muted);display:block;font-size:var(--text-xs)">Stock Actual</span>
                    <span style="color:var(--fire-300);font-weight:800">${formatQuantity(item.currentStock)} ${item.unit}</span>
                  </div>
                  <div>
                    <span style="color:var(--text-muted);display:block;font-size:var(--text-xs)">Stock Mínimo</span>
                    <span style="font-weight:600">${formatQuantity(item.minStock)} ${item.unit}</span>
                  </div>
                </div>
              </div>
              <button class="btn btn-secondary btn-sm btn-reponer" data-id="${item.id}" style="width:100%;margin-top:var(--space-2)">
                📥 Registrar Reposición
              </button>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  tabContainer.querySelectorAll('.btn-reponer').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemId = Number(e.currentTarget.dataset.id);
      openMovementModal(container, itemId, 'ENTRADA');
    });
  });
}

/** 📜 TAB 3: HISTORIAL DE MOVIMIENTOS */
function renderHistoryTab(tabContainer) {
  const filteredMovements = historyItemFilter
    ? currentMovements.filter(m => m.itemId === Number(historyItemFilter))
    : currentMovements;

  tabContainer.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4);gap:var(--space-4);flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:var(--space-3)">
        <label style="font-size:var(--text-sm);color:var(--text-muted)">Filtrar por insumo:</label>
        <select class="input" id="history-filter-item" style="width:220px">
          <option value="">Todos los insumos</option>
          ${currentItems.map(i => `<option value="${i.id}" ${historyItemFilter == i.id ? 'selected' : ''}>${i.name}</option>`).join('')}
        </select>
      </div>
      <p style="color:var(--text-muted);font-size:var(--text-xs)">
        Mostrando ${filteredMovements.length} movimientos recientes
      </p>
    </div>

    ${filteredMovements.length === 0 ? `
      <div class="empty-state" style="padding:var(--space-8)">
        <div class="empty-icon">📜</div>
        <p>No hay registro de movimientos de inventario aún</p>
      </div>
    ` : `
      <div class="panel" style="padding:0;overflow-x:auto">
        <table class="data-table" style="width:100%">
          <thead>
            <tr>
              <th>Fecha / Hora</th>
              <th>Insumo</th>
              <th>Tipo Movimiento</th>
              <th>Cantidad</th>
              <th>Costo Unit.</th>
              <th>Referencia</th>
              <th>Nota / Motivo</th>
            </tr>
          </thead>
          <tbody>
            ${filteredMovements.map(m => {
              const dateStr = formatDate(m.createdAt);
              const movBadge = getMovementBadge(m.movementType);
              const item = currentItems.find(i => i.id === m.itemId);
              const unit = item?.unit || '';

              return `
                <tr>
                  <td style="white-space:nowrap;font-size:var(--text-xs);color:var(--text-secondary)">${dateStr}</td>
                  <td><strong>${m.itemName || item?.name || `Insumo #${m.itemId}`}</strong></td>
                  <td>${movBadge}</td>
                  <td>
                    <strong style="color:${m.movementType === 'ENTRADA' ? 'var(--status-online)' : (m.movementType === 'AJUSTE' ? 'var(--text-gold)' : 'var(--status-offline)')}">
                      ${m.movementType === 'ENTRADA' ? '+' : (m.movementType === 'SALIDA' || m.movementType === 'MERMA' ? '-' : '')}${formatQuantity(m.quantity)} ${unit}
                    </strong>
                  </td>
                  <td>${m.unitCost ? formatCurrency(m.unitCost) : '—'}</td>
                  <td><code style="font-size:var(--text-xs);color:var(--amber-500)">${m.referenceType}</code></td>
                  <td style="color:var(--text-muted);font-size:var(--text-xs)">${m.notes || '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;

  tabContainer.querySelector('#history-filter-item')?.addEventListener('change', (e) => {
    historyItemFilter = e.target.value;
    renderHistoryTab(tabContainer);
  });
}

/** 📝 MODAL: REGISTRAR MOVIMIENTO (POST /api/v1/inventory/movements) */
function openMovementModal(container, defaultItemId = null, defaultType = 'ENTRADA') {
  // Evitar modales duplicados
  document.getElementById('movement-modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'movement-modal-overlay';
  overlay.className = 'modal-overlay';

  const selectedItem = currentItems.find(i => i.id === defaultItemId) || currentItems[0];
  const defaultCost = selectedItem ? selectedItem.costPerUnit : '';

  overlay.innerHTML = `
    <div class="modal" style="max-width:540px">
      <div class="modal-header">
        <h3 class="modal-title">📦 Registrar Movimiento</h3>
        <button class="btn btn-ghost btn-sm" id="btn-close-modal">✕</button>
      </div>
      <div class="modal-body">
        <form id="movement-form">
          <div class="input-group" style="margin-bottom:var(--space-4)">
            <label class="input-label">Insumo <span style="color:#F87171">*</span></label>
            <select class="input" id="mov-item-id" required style="width:100%">
              ${currentItems.map(i => `
                <option value="${i.id}" ${i.id === defaultItemId ? 'selected' : ''}>
                  ${i.name} (Stock actual: ${formatQuantity(i.currentStock)} ${i.unit})
                </option>
              `).join('')}
            </select>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-4)">
            <div class="input-group">
              <label class="input-label">Tipo de Movimiento <span style="color:#F87171">*</span></label>
              <select class="input" id="mov-type" required style="width:100%">
                <option value="ENTRADA" ${defaultType === 'ENTRADA' ? 'selected' : ''}>🟢 Entrada (Compra/Ingreso)</option>
                <option value="SALIDA" ${defaultType === 'SALIDA' ? 'selected' : ''}>🟠 Salida (Consumo/Despacho)</option>
                <option value="AJUSTE" ${defaultType === 'AJUSTE' ? 'selected' : ''}>🔵 Ajuste (Corrección total)</option>
                <option value="MERMA" ${defaultType === 'MERMA' ? 'selected' : ''}>🔴 Merma (Desperdicio/Daño)</option>
              </select>
            </div>

            <div class="input-group">
              <label class="input-label">Cantidad <span style="color:#F87171">*</span></label>
              <input class="input" id="mov-quantity" type="number" step="0.001" min="0.001" placeholder="Ej: 500" required style="width:100%" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-4)">
            <div class="input-group">
              <label class="input-label">Costo por Unidad (COP)</label>
              <input class="input" id="mov-unit-cost" type="number" step="1" min="0" value="${defaultCost}" placeholder="Costo unitario" style="width:100%" />
            </div>

            <div class="input-group">
              <label class="input-label">Tipo de Referencia</label>
              <select class="input" id="mov-ref-type" style="width:100%">
                <option value="MANUAL" selected>Manual</option>
                <option value="COMPRA">Compra a Proveedor</option>
                <option value="AJUSTE">Ajuste de Conteo</option>
                <option value="PEDIDO">Pedido / Venta</option>
                <option value="RECETA">Producción / Receta</option>
              </select>
            </div>
          </div>

          <div class="input-group" style="margin-bottom:var(--space-4)">
            <label class="input-label">Motivo / Notas</label>
            <textarea class="input" id="mov-notes" rows="2" placeholder="Detalles u observaciones del movimiento..." style="width:100%;resize:vertical"></textarea>
          </div>

          <div class="modal-footer" style="padding:0;border:none;margin-top:var(--space-5)">
            <button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btn-submit-mov">
              💾 Guardar Movimiento
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Auto-fill costo unitario cuando cambia el insumo
  const itemSelect = overlay.querySelector('#mov-item-id');
  const costInput = overlay.querySelector('#mov-unit-cost');
  itemSelect?.addEventListener('change', (e) => {
    const item = currentItems.find(i => i.id === Number(e.target.value));
    if (item && costInput) {
      costInput.value = item.costPerUnit || '';
    }
  });

  // Cerrar modal
  const closeModal = () => overlay.remove();
  overlay.querySelector('#btn-close-modal')?.addEventListener('click', closeModal);
  overlay.querySelector('#btn-cancel-modal')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Submit del Formulario
  const form = overlay.querySelector('#movement-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = overlay.querySelector('#btn-submit-mov');

    const itemId = Number(overlay.querySelector('#mov-item-id').value);
    const movementType = overlay.querySelector('#mov-type').value;
    const quantity = parseFloat(overlay.querySelector('#mov-quantity').value);
    const unitCostVal = overlay.querySelector('#mov-unit-cost').value;
    const referenceType = overlay.querySelector('#mov-ref-type').value;
    const notes = overlay.querySelector('#mov-notes').value.trim();

    if (!itemId || isNaN(quantity) || quantity <= 0) {
      toast.error('Por favor ingrese una cantidad válida mayor a 0');
      return;
    }

    try {
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '⏳ Guardando...';
      }

      await inventoryService.registerMovement({
        itemId,
        movementType,
        quantity,
        unitCost: unitCostVal ? parseFloat(unitCostVal) : undefined,
        referenceType,
        notes: notes || undefined,
        performedBy: 1, // Default user
      });

      toast.success('✅ Movimiento registrado exitosamente');
      closeModal();

      // ACTUALIZACIÓN AUTOMÁTICA DE DATOS Y VISTA
      await loadInventoryData(container);

    } catch (err) {
      toast.error(`Error: ${err.message || 'No se pudo registrar el movimiento'}`);
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '💾 Guardar Movimiento';
      }
    }
  });
}

// ── UTILIDADES DE FORMATO Y ESTILO ──────────────────────
function formatQuantity(val) {
  const num = Number(val);
  if (isNaN(num)) return '0';
  return num % 1 === 0 ? num.toString() : num.toFixed(2);
}

function formatDate(dateVal) {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getMovementBadge(type) {
  switch (type) {
    case 'ENTRADA': return `<span class="badge badge-green">📥 ENTRADA</span>`;
    case 'SALIDA':  return `<span class="badge badge-amber">📤 SALIDA</span>`;
    case 'AJUSTE':  return `<span class="badge badge-blue">🔵 AJUSTE</span>`;
    case 'MERMA':   return `<span class="badge badge-red">🔴 MERMA</span>`;
    default:        return `<span class="badge badge-gray">${type}</span>`;
  }
}

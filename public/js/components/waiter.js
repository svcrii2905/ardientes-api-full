import { tablesService } from "../services/tables.service.js";
import { catalogService } from "../services/catalog.service.js";
import { wsService } from "../services/websocket.service.js";
import { formatCurrency } from "../utils/currency.js";
import { openToppingModal } from "./toppingModal.js";
import { renderPromos, PROMOTIONS } from "./promos.js";

let tables = [];
let selectedTable = null;
let activeOrders = [];
let categories = [];
let products = [];
let waiterCart = { items: [], beverages: [], notes: "" };
let wsSubscribed = false;
let selectedMenuSection = null; // null (Hub), 'UNIVERSITARIO', 'ESPECIAL', 'PROMOS'
let selectedCategoryId = null;


/**
 * Inicializa y renderiza la vista de Mesero
 * @param {HTMLElement} container
 */
export async function renderWaiterView(container) {
  container.innerHTML = `
    <div class="waiter-container" id="waiter-root">
      <div class="waiter-header">
        <div class="waiter-title-group">
          <h1 class="waiter-title">🔥 ARDIENTES — MESAS</h1>
          <span class="waiter-badge-ws" id="waiter-ws-status">🟢 En vivo</span>
        </div>
        <div class="waiter-summary-bar" id="waiter-summary-bar">
          <span class="summary-chip chip-libre">🟢 <b id="count-libres">0</b> Libres</span>
          <span class="summary-chip chip-ocupada">🔴 <b id="count-ocupadas">0</b> Ocupadas</span>
          <span class="summary-chip chip-cuenta" id="chip-cuenta" style="display:none">🔔 <b id="count-cuentas">0</b> Cuentas</span>
        </div>
      </div>

      <!-- Vista 1: Grilla de 7 Mesas -->
      <div id="waiter-tables-view" class="waiter-tables-grid">
        <div class="waiter-loading">Cargando mesas...</div>
      </div>

      <!-- Vista 2: Detalle de Mesa seleccionada -->
      <div id="waiter-detail-modal" class="modal-overlay" style="display:none">
        <div class="modal-card waiter-modal-card">
          <div class="modal-header">
            <h2 id="detail-table-title" class="modal-title">MESA</h2>
            <button class="btn btn-ghost btn-icon" id="btn-close-detail" style="font-size:1.5rem">✕</button>
          </div>
          <div class="modal-body" id="detail-modal-body"></div>
        </div>
      </div>

      <!-- Vista 3: Toma de Pedidos Táctil -->
      <div id="waiter-order-modal" class="modal-overlay" style="display:none">
        <div class="modal-card waiter-modal-card waiter-order-card">
          <div class="modal-header">
            <h2 id="order-table-title" class="modal-title">➕ NUEVO PEDIDO</h2>
            <button class="btn btn-ghost btn-icon" id="btn-close-order" style="font-size:1.5rem">✕</button>
          </div>
          <div class="modal-body waiter-order-body" id="order-modal-body"></div>
          <div class="modal-footer waiter-order-footer" id="order-modal-footer"></div>
        </div>
      </div>

      <!-- Vista 4: Modal Trasladar Mesa -->
      <div id="waiter-transfer-modal" class="modal-overlay" style="display:none">
        <div class="modal-card" style="max-width:480px">
          <div class="modal-header">
            <h2 class="modal-title">🔄 Cambiar de Mesa</h2>
            <button class="btn btn-ghost btn-icon" id="btn-close-transfer" style="font-size:1.5rem">✕</button>
          </div>
          <div class="modal-body" id="transfer-modal-body"></div>
        </div>
      </div>
    </div>
  `;

  setupEventListeners();
  setupWebSocket();
  await loadCatalogData();
  await loadTables();
}

async function loadCatalogData() {
  try {
    const [cats, prods] = await Promise.all([
      catalogService.getCategories(),
      catalogService.getProducts(),
    ]);
    categories = cats || [];
    products = prods || [];
  } catch (err) {
    console.error("Error al cargar catálogo en mesero:", err);
  }
}

async function loadTables() {
  try {
    const res = await tablesService.getTables();
    tables = res.data || [];
    renderTablesGrid();
    updateSummary();
  } catch (err) {
    const grid = document.getElementById("waiter-tables-view");
    if (grid) {
      grid.innerHTML = `<div class="waiter-error">⚠️ Error al cargar mesas: ${err.message}</div>`;
    }
  }
}

function updateSummary() {
  const libres = tables.filter((t) => t.status === "LIBRE").length;
  const ocupadas = tables.filter((t) => t.status === "OCUPADA").length;
  const cuentas = tables.filter((t) => t.accountRequested).length;

  const elLibres = document.getElementById("count-libres");
  const elOcupadas = document.getElementById("count-ocupadas");
  const elCuentas = document.getElementById("count-cuentas");
  const chipCuenta = document.getElementById("chip-cuenta");

  if (elLibres) elLibres.textContent = libres;
  if (elOcupadas) elOcupadas.textContent = ocupadas;
  if (elCuentas) elCuentas.textContent = cuentas;
  if (chipCuenta) chipCuenta.style.display = cuentas > 0 ? "inline-flex" : "none";
}

function renderTablesGrid() {
  const grid = document.getElementById("waiter-tables-view");
  if (!grid) return;

  grid.innerHTML = tables
    .map((t) => {
      const isOcupada = t.status === "OCUPADA";
      const hasBillRequested = t.accountRequested;
      return `
        <div class="waiter-table-card ${isOcupada ? "table-occupied" : "table-free"} ${hasBillRequested ? "table-bill-requested" : ""}"
             data-table-id="${t.id}">
          <div class="table-card-header">
            <span class="table-number-label">${t.name}</span>
            <span class="table-status-pill ${isOcupada ? "pill-ocupada" : "pill-libre"}">
              ${isOcupada ? "🔴 OCUPADA" : "🟢 LIBRE"}
            </span>
          </div>

          ${hasBillRequested ? `
            <div class="table-card-alert">
              🔔 CUENTA SOLICITADA
            </div>
          ` : ""}

          <div class="table-card-body">
            ${isOcupada ? `
              <div class="table-card-metric">
                <span class="metric-label">Pedidos activos:</span>
                <span class="metric-value">${t.activeOrdersCount || 1}</span>
              </div>
              <div class="table-card-metric">
                <span class="metric-label">Total acumulado:</span>
                <span class="metric-value table-total-value">${formatCurrency(t.totalPendingAmount || 0)}</span>
              </div>
            ` : `
              <div class="table-card-empty">
                <span>Disponible para clientes</span>
              </div>
            `}
          </div>

          <div class="table-card-footer">
            <button class="btn btn-block ${isOcupada ? "btn-secondary" : "btn-primary"} btn-lg table-action-btn"
                    data-action="open-detail" data-table-id="${t.id}">
              ${isOcupada ? "👁️ Ver Mesa" : "➕ Abrir Mesa"}
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  // Event listeners para las tarjetas
  grid.querySelectorAll(".waiter-table-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = Number(card.dataset.tableId);
      openTableDetail(id);
    });
  });
}

async function openTableDetail(tableId) {
  selectedTable = tables.find((t) => t.id === tableId);
  if (!selectedTable) return;

  const modal = document.getElementById("waiter-detail-modal");
  const title = document.getElementById("detail-table-title");
  const body = document.getElementById("detail-modal-body");

  title.textContent = `${selectedTable.name} · ${selectedTable.status}`;
  body.innerHTML = `<div class="waiter-loading">Consultando pedidos de la mesa...</div>`;
  modal.style.display = "flex";

  try {
    const res = await tablesService.getTableOrders(tableId, true);
    activeOrders = res.data || [];
    renderTableDetailBody();
  } catch (err) {
    body.innerHTML = `<div class="waiter-error">Error al cargar pedidos: ${err.message}</div>`;
  }
}

function renderTableDetailBody() {
  const body = document.getElementById("detail-modal-body");
  if (!body || !selectedTable) return;

  const totalPending = activeOrders.reduce((acc, o) => acc + (o.total || 0), 0);

  let ordersHtml = "";
  if (activeOrders.length === 0) {
    ordersHtml = `
      <div class="detail-empty-state">
        <p>No hay pedidos activos registrados en esta mesa.</p>
      </div>
    `;
  } else {
    ordersHtml = `
      <div class="detail-orders-list">
        ${activeOrders
          .map(
            (o) => `
          <div class="detail-order-item">
            <div class="detail-order-header">
              <b>${o.dailyOrderNumber ? `PEDIDO ${o.dailyOrderNumber}` : (o.orderNumber ? `#${o.orderNumber}` : `#${o.id}`)}</b>
              <span class="badge ${o.status === "LISTO" ? "badge-success" : "badge-info"}">
                ${o.status}
              </span>
              ${o.paidAt ? '<span class="badge" style="background:rgba(46,213,115,0.1);color:var(--status-online);">🟢 Pagado</span>' : '<span class="badge" style="background:rgba(255,165,2,0.1);color:var(--amber-500);">🟠 Pendiente</span>'}
              <span class="detail-order-total">${formatCurrency(o.total)}</span>
            </div>
            <div class="detail-order-products">
              ${o.items
                .map(
                  (i) => `
                <div class="order-line">
                  <span>${i.quantity}x ${i.productName || "Producto"}</span>
                  ${i.toppings?.length ? `<small class="line-toppings">+ ${i.toppings.map((t) => t.toppingName).join(", ")}</small>` : ""}
                </div>
              `
                )
                .join("")}
              ${o.beverages
                .map(
                  (b) => `
                <div class="order-line">
                  <span>${b.quantity}x ${b.beverageName || "Bebida"}</span>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  body.innerHTML = `
    <div class="table-detail-container">
      <div class="detail-info-bar">
        <div class="info-metric">
          <span class="info-label">Estado:</span>
          <span class="info-value ${selectedTable.status === "OCUPADA" ? "text-danger" : "text-success"}">
            ${selectedTable.status}
          </span>
        </div>
        ${selectedTable.accountRequested ? `
          <div class="info-metric">
            <span class="badge badge-warning" style="font-size:1rem; padding:6px 12px">🔔 Cuenta Solicitada</span>
          </div>
        ` : ""}
        <div class="info-metric">
          <span class="info-label">Total Pendiente:</span>
          <span class="info-value info-total">${formatCurrency(totalPending)}</span>
        </div>
      </div>

      <div class="detail-orders-section">
        <h3>📋 Pedidos Activos (${activeOrders.length})</h3>
        ${ordersHtml}
      </div>

      <div class="detail-actions-grid">
        <button class="btn btn-primary btn-lg btn-tactile" id="btn-add-order">
          ➕ NUEVO PEDIDO
        </button>

        ${selectedTable.status === "OCUPADA" && activeOrders.length > 0 ? `
          <button class="btn btn-warning btn-lg btn-tactile" id="btn-request-bill" ${selectedTable.accountRequested ? "disabled" : ""}>
            🔔 ${selectedTable.accountRequested ? "CUENTA YA SOLICITADA" : "SOLICITAR CUENTA"}
          </button>
          <button class="btn btn-secondary btn-lg btn-tactile" id="btn-transfer-table">
            🔄 CAMBIAR DE MESA
          </button>
        ` : ""}
      </div>
    </div>
  `;

  // Listeners de acciones en detalle
  document.getElementById("btn-add-order")?.addEventListener("click", () => {
    closeTableDetail();
    openOrderTaking(selectedTable);
  });

  document.getElementById("btn-request-bill")?.addEventListener("click", async () => {
    try {
      await tablesService.requestBill(selectedTable.id);
      selectedTable.accountRequested = true;
      renderTableDetailBody();
      updateSummary();
    } catch (err) {
      alert("Error al solicitar cuenta: " + err.message);
    }
  });

  document.getElementById("btn-transfer-table")?.addEventListener("click", () => {
    openTransferModal(selectedTable);
  });
}

function closeTableDetail() {
  const modal = document.getElementById("waiter-detail-modal");
  if (modal) modal.style.display = "none";
}

// ─── Modal Trasladar Mesa ───────────────────────────────────────────────────
function openTransferModal(table) {
  const modal = document.getElementById("waiter-transfer-modal");
  const body = document.getElementById("transfer-modal-body");
  if (!modal || !body) return;

  const freeTables = tables.filter((t) => t.status === "LIBRE" && t.id !== table.id);

  if (freeTables.length === 0) {
    body.innerHTML = `
      <p class="text-danger">⚠️ No hay otras mesas libres en este momento para trasladar los pedidos.</p>
    `;
  } else {
    body.innerHTML = `
      <p>Selecciona la mesa libre a la cual deseas trasladar todos los pedidos activos de <b>${table.name}</b>:</p>
      <div class="transfer-options-list">
        ${freeTables
          .map(
            (ft) => `
          <button class="btn btn-secondary btn-block btn-lg btn-transfer-select" data-target-id="${ft.id}" style="margin-bottom:8px">
            🟢 ${ft.name} (Libre)
          </button>
        `
          )
          .join("")}
      </div>
    `;

    body.querySelectorAll(".btn-transfer-select").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const targetId = Number(btn.dataset.targetId);
        btn.disabled = true;
        btn.textContent = "Trasladando...";
        try {
          await tablesService.transferTable(table.id, targetId);
          modal.style.display = "none";
          closeTableDetail();
          await loadTables();
        } catch (err) {
          alert("Error al cambiar de mesa: " + err.message);
          btn.disabled = false;
        }
      });
    });
  }

  modal.style.display = "flex";
}

function calculateWaiterItemCount() {
  const itemsCount = (waiterCart.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
  const bevCount = (waiterCart.beverages || []).reduce((s, b) => s + (b.quantity || 1), 0);
  return itemsCount + bevCount;
}

function toggleMobileCart(expand) {
  const orderCard = document.querySelector(".waiter-order-card");
  if (!orderCard) return;
  if (typeof expand === "boolean") {
    orderCard.classList.toggle("waiter-cart-expanded", expand);
  } else {
    orderCard.classList.toggle("waiter-cart-expanded");
  }
}

// ─── Toma de Pedidos Táctil ─────────────────────────────────────────────────
function openOrderTaking(table) {
  selectedTable = table;
  waiterCart = { items: [], beverages: [], notes: "" };
  selectedMenuSection = null;
  selectedCategoryId = null;

  const modal = document.getElementById("waiter-order-modal");
  const title = document.getElementById("order-table-title");
  title.textContent = `Tomar Pedido — ${table.name}`;

  renderOrderTakingView();
  toggleMobileCart(false);
  modal.style.display = "flex";
}

function closeOrderTaking() {
  const modal = document.getElementById("waiter-order-modal");
  toggleMobileCart(false);
  selectedMenuSection = null;
  selectedCategoryId = null;
  if (modal) modal.style.display = "none";
  openTableDetail(selectedTable.id);
}

function renderOrderTakingView() {
  const body = document.getElementById("order-modal-body");
  const footer = document.getElementById("order-modal-footer");
  if (!body || !footer) return;

  const initialCount = calculateWaiterItemCount();

  let leftContentHtml = "";

  if (selectedMenuSection === null) {
    // ─── PANTALLA PRINCIPAL: 3 APARTADOS DE MENÚ ───
    leftContentHtml = `
      <div class="waiter-hub-selection" id="waiter-hub-selection">
        <div class="waiter-hub-card hub-card-universitario" data-section="UNIVERSITARIO">
          <div class="hub-card-icon">🎓</div>
          <div class="hub-card-content">
            <div class="hub-card-title">MENÚ UNIVERSITARIO</div>
            <div class="hub-card-desc">Productos económicos con hasta 4 toppings incluidos</div>
            <span class="hub-card-badge">Económico · Máx 4 toppings</span>
          </div>
          <div class="hub-card-arrow">➜</div>
        </div>

        <div class="waiter-hub-card hub-card-especial" data-section="ESPECIAL">
          <div class="hub-card-icon">⭐</div>
          <div class="hub-card-content">
            <div class="hub-card-title">MENÚ ESPECIAL</div>
            <div class="hub-card-desc">Toppings ilimitados + lluvia de queso gratinado</div>
            <span class="hub-card-badge">Especial · Toppings ilimitados</span>
          </div>
          <div class="hub-card-arrow">➜</div>
        </div>

        <div class="waiter-hub-card hub-card-promos" data-section="PROMOS">
          <div class="hub-card-icon">🔥</div>
          <div class="hub-card-content">
            <div class="hub-card-title">PROMOS</div>
            <div class="hub-card-desc">Combos y ofertas especiales disponibles</div>
            <span class="hub-card-badge">Promociones activas</span>
          </div>
          <div class="hub-card-arrow">➜</div>
        </div>
      </div>
    `;
  } else if (selectedMenuSection === "PROMOS") {
    // ─── SECCIÓN PROMOS ───
    leftContentHtml = `
      <div class="waiter-nav-subbar">
        <button class="btn btn-secondary btn-back-hub" id="btn-back-hub">← Volver a Menús</button>
        <span class="waiter-nav-subbar-title">🔥 Promociones</span>
      </div>
      <div class="waiter-products-grid waiter-promos-grid" id="waiter-products-list" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));"></div>
    `;
  } else {
    // ─── SECCIÓN UNIVERSITARIO / ESPECIAL ───
    const sectionTitle = selectedMenuSection === "UNIVERSITARIO" ? "🎓 Menú Universitario" : "⭐ Menú Especial";
    const availableCategories = categories.filter((c) =>
      products.some((p) => p.categoryId === c.id && p.isActive && (p.availableIn === selectedMenuSection || p.availableIn === "AMBOS"))
    );

    if (!selectedCategoryId || !availableCategories.some((c) => c.id === selectedCategoryId)) {
      selectedCategoryId = availableCategories[0]?.id || null;
    }

    leftContentHtml = `
      <div class="waiter-nav-subbar">
        <button class="btn btn-secondary btn-back-hub" id="btn-back-hub">← Volver a Menús</button>
        <span class="waiter-nav-subbar-title">${sectionTitle}</span>
      </div>
      <div class="waiter-category-scroll-wrapper" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <button class="btn btn-secondary btn-icon" id="btn-scroll-left" style="flex-shrink: 0; border-radius: 50%; width: 40px; height: 40px; padding: 0;">&larr;</button>
        <div class="waiter-category-tabs" id="waiter-category-tabs-container" style="flex: 1; overflow-x: hidden; scroll-behavior: smooth;">
          ${availableCategories
            .map(
              (c) => `
            <button class="category-tab ${c.id === selectedCategoryId ? "active" : ""}" data-cat-id="${c.id}">
              ${c.name}
            </button>
          `
            )
            .join("")}
        </div>
        <button class="btn btn-secondary btn-icon" id="btn-scroll-right" style="flex-shrink: 0; border-radius: 50%; width: 40px; height: 40px; padding: 0;">&rarr;</button>
      </div>
      <div class="waiter-products-grid" id="waiter-products-list"></div>
    `;
  }

  body.innerHTML = `
    <div class="waiter-order-layout">
      <!-- Columna Izquierda: Menú Táctil / Hub -->
      <div class="waiter-menu-column">
        ${leftContentHtml}

        <!-- Barra inferior resumen móvil de comanda -->
        <div class="waiter-mobile-cart-bar" id="waiter-mobile-cart-bar">
          <div class="mobile-cart-bar-info">
            <span class="mobile-cart-bar-title">🛒 Ver comanda</span>
            <span class="mobile-cart-bar-count" id="waiter-mobile-cart-count">${initialCount} ${initialCount === 1 ? "producto" : "productos"}</span>
          </div>
          <div class="mobile-cart-bar-action">
            <span class="mobile-cart-bar-total" id="waiter-mobile-cart-total">${formatCurrency(calculateWaiterTotal())}</span>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-toggle-mobile-cart">Ver comanda ↑</button>
          </div>
        </div>
      </div>

      <!-- Columna Derecha: Carrito del Mesero -->
      <div class="waiter-cart-column">
        <div class="waiter-cart-header">
          <h3>🛒 Resumen de la Comanda</h3>
          <button type="button" class="btn btn-ghost btn-sm btn-mobile-close-cart" id="btn-close-mobile-cart">↓ Volver al menú</button>
        </div>
        <div class="waiter-cart-items" id="waiter-cart-items">
          ${renderWaiterCartLines()}
        </div>
        <div class="waiter-cart-total-bar">
          <span>Total:</span>
          <b id="waiter-cart-total">${formatCurrency(calculateWaiterTotal())}</b>
        </div>
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button class="btn btn-ghost btn-lg" id="btn-cancel-order">Cancelar</button>
    <button class="btn btn-primary btn-lg btn-tactile" id="btn-submit-order" ${waiterCart.items.length === 0 && waiterCart.beverages.length === 0 ? "disabled" : ""}>
      🚀 CONFIRMAR Y ENVIAR A COCINA
    </button>
  `;

  // Listeners según la vista activa
  if (selectedMenuSection === null) {
    body.querySelectorAll(".waiter-hub-card").forEach((card) => {
      card.addEventListener("click", () => {
        selectedMenuSection = card.dataset.section;
        selectedCategoryId = null;
        renderOrderTakingView();
      });
    });
  } else if (selectedMenuSection === "PROMOS") {
    document.getElementById("btn-back-hub")?.addEventListener("click", () => {
      selectedMenuSection = null;
      renderOrderTakingView();
    });

    const list = document.getElementById("waiter-products-list");
    if (list) {
      renderPromos(list, { compact: true });
      list.querySelectorAll(".promo-card").forEach((card) => {
        const clone = card.cloneNode(true);
        card.replaceWith(clone);
        clone.addEventListener("click", async () => {
          const promoId = clone.dataset.promoId;
          const promo = PROMOTIONS.find((p) => p.id === promoId);
          if (!promo) return;
          await openWaiterPromoModal(promo);
        });
      });
    }
  } else {
    // Universitario o Especial
    document.getElementById("btn-back-hub")?.addEventListener("click", () => {
      selectedMenuSection = null;
      renderOrderTakingView();
    });

    if (selectedCategoryId) {
      showProductsForCategory(selectedCategoryId, selectedMenuSection);
    }

    body.querySelectorAll(".category-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        body.querySelectorAll(".category-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        selectedCategoryId = Number(tab.dataset.catId);
        showProductsForCategory(selectedCategoryId, selectedMenuSection);
      });
    });

    const tabsContainer = document.getElementById("waiter-category-tabs-container");
    document.getElementById("btn-scroll-left")?.addEventListener("click", () => {
      if (tabsContainer) tabsContainer.scrollBy({ left: -200, behavior: "smooth" });
    });
    document.getElementById("btn-scroll-right")?.addEventListener("click", () => {
      if (tabsContainer) tabsContainer.scrollBy({ left: 200, behavior: "smooth" });
    });
  }

  document.getElementById("btn-cancel-order")?.addEventListener("click", closeOrderTaking);
  document.getElementById("btn-submit-order")?.addEventListener("click", submitWaiterOrder);

  // Listeners para alternar la comanda en móvil
  document.getElementById("btn-toggle-mobile-cart")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMobileCart(true);
  });
  document.getElementById("waiter-mobile-cart-bar")?.addEventListener("click", () => {
    toggleMobileCart(true);
  });
  document.getElementById("btn-close-mobile-cart")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMobileCart(false);
  });

  refreshWaiterCartUI();
}

function showProductsForCategory(categoryId, menuSection) {
  const list = document.getElementById("waiter-products-list");
  if (!list) return;

  const prods = products.filter(
    (p) => p.categoryId === categoryId && p.isActive && (!menuSection || p.availableIn === menuSection || p.availableIn === "AMBOS")
  );

  list.innerHTML = prods
    .map((p) => {
      const price = menuSection === "ESPECIAL"
        ? (p.priceEspecial || p.priceUniversitario || 0)
        : (p.priceUniversitario || p.priceEspecial || 0);
      return `
      <div class="waiter-product-card" data-product-id="${p.id}">
        <div class="prod-name">${p.name}</div>
        <div class="prod-price">${formatCurrency(price)}</div>
        <button class="btn btn-sm btn-primary btn-block btn-add-prod" data-product-id="${p.id}">
          + Agregar
        </button>
      </div>
    `;
    })
    .join("");

  list.querySelectorAll(".btn-add-prod").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pid = Number(btn.dataset.productId);
      const product = products.find((p) => p.id === pid);
      if (product) handleAddProductToWaiterCart(product, menuSection);
    });
  });
}

function handleAddProductToWaiterCart(product, menuSection) {
  const resolvedMenu = menuSection || (product.availableIn === "ESPECIAL" ? "ESPECIAL" : "UNIVERSITARIO");

  // Si tiene toppings, abrimos el modal de toppings configurado
  if (product.hasToppings) {
    openToppingModal(product, resolvedMenu, (customizedItem) => {
      waiterCart.items.push({
        productId: customizedItem.productId || product.id,
        name: customizedItem.name || product.name,
        quantity: customizedItem.quantity || customizedItem.qty || 1,
        menuType: customizedItem.menuType || resolvedMenu,
        unitPrice: customizedItem.unitPrice,
        toppings: customizedItem.toppings || [],
        notes: customizedItem.notes || undefined,
      });
      refreshWaiterCartUI();
    });
  } else {
    // Si no tiene toppings (ej. bebida o producto simple)
    if (product.categoryId === 8) { // Bebidas
      waiterCart.beverages.push({
        beverageId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.priceUniversitario || product.priceEspecial || 0,
      });
    } else {
      const price = resolvedMenu === "ESPECIAL"
        ? (product.priceEspecial || product.priceUniversitario || 0)
        : (product.priceUniversitario || product.priceEspecial || 0);

      waiterCart.items.push({
        productId: product.id,
        name: product.name,
        quantity: 1,
        menuType: resolvedMenu,
        unitPrice: price,
        toppings: [],
      });
    }
    refreshWaiterCartUI();
  }
}

function renderWaiterCartLines() {
  if (waiterCart.items.length === 0 && waiterCart.beverages.length === 0) {
    return `<p class="cart-empty-text">Toca un producto para agregarlo a la comanda.</p>`;
  }

  let html = "";
  waiterCart.items.forEach((item, index) => {
    const toppingsStr = item.toppings?.length ? `<small>+ ${item.toppings.map((t) => t.name || t.toppingName).join(", ")}</small>` : "";
    const notesStr = item.notes ? `<small style="color:var(--status-online);display:block;">${item.notes}</small>` : "";
    html += `
      <div class="waiter-cart-line">
        <div class="line-info">
          <b>${item.quantity}x ${item.name}</b>
          ${toppingsStr}
          ${notesStr}
        </div>
        <div class="line-actions">
          <button class="btn btn-ghost btn-xs btn-remove-item" data-index="${index}">🗑️</button>
        </div>
      </div>
    `;
  });

  waiterCart.beverages.forEach((bev, index) => {
    html += `
      <div class="waiter-cart-line">
        <div class="line-info">
          <b>${bev.quantity}x ${bev.name}</b>
        </div>
        <div class="line-actions">
          <button class="btn btn-ghost btn-xs btn-remove-bev" data-index="${index}">🗑️</button>
        </div>
      </div>
    `;
  });

  return html;
}

function refreshWaiterCartUI() {
  const container = document.getElementById("waiter-cart-items");
  const totalEl = document.getElementById("waiter-cart-total");
  const submitBtn = document.getElementById("btn-submit-order");

  if (container) {
    container.innerHTML = renderWaiterCartLines();

    container.querySelectorAll(".btn-remove-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index);
        waiterCart.items.splice(idx, 1);
        refreshWaiterCartUI();
      });
    });

    container.querySelectorAll(".btn-remove-bev").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index);
        waiterCart.beverages.splice(idx, 1);
        refreshWaiterCartUI();
      });
    });
  }

  const total = calculateWaiterTotal();
  if (totalEl) totalEl.textContent = formatCurrency(total);
  if (submitBtn) {
    submitBtn.disabled = waiterCart.items.length === 0 && waiterCart.beverages.length === 0;
  }

  // Sincronizar barra de comanda móvil
  const countEl = document.getElementById("waiter-mobile-cart-count");
  const mobileTotalEl = document.getElementById("waiter-mobile-cart-total");
  const count = calculateWaiterItemCount();
  if (countEl) {
    countEl.textContent = `${count} ${count === 1 ? "producto" : "productos"}`;
  }
  if (mobileTotalEl) {
    mobileTotalEl.textContent = formatCurrency(total);
  }
}

function calculateWaiterTotal() {
  let total = 0;
  for (const item of waiterCart.items) {
    let toppingExtra = 0;
    if (item.toppings) {
      toppingExtra = item.toppings.reduce((s, t) => s + (t.extraPrice || 0) * (t.quantity || 1), 0);
    }
    total += (item.unitPrice + toppingExtra) * item.quantity;
  }
  for (const bev of waiterCart.beverages) {
    total += bev.unitPrice * bev.quantity;
  }
  return total;
}

async function submitWaiterOrder() {
  const btn = document.getElementById("btn-submit-order");
  if (!btn || !selectedTable) return;

  btn.disabled = true;
  btn.textContent = "Guardando pedido...";

  // Todos los ítems válidos (incluyendo promos que ahora tienen productId real)
  const allItems = waiterCart.items.filter(i => i.productId);

  const itemNotes = allItems
    .filter(i => i.notes)
    .map(i => `[${i.name}: ${i.notes}]`)
    .join(" ");

  const allNotes = [waiterCart.notes, itemNotes].filter(Boolean).join(" ");
  const totalDiscount = allItems.reduce((acc, i) => acc + (i.promoDiscount || 0), 0);

  const orderBeverages = (waiterCart.beverages || []).map((b) => ({
    beverageId: b.beverageId,
    quantity: b.quantity || b.qty || 1,
  }));

  allItems.forEach(i => {
    if (i._promoBeverage && i._promoBeverage.beverageId) {
      orderBeverages.push({
        beverageId: i._promoBeverage.beverageId,
        quantity: i.quantity || i.qty || 1,
        overridePrice: 0,
      });
    }
  });

  const payload = {
    orderType: 'MESA',
    tableId: selectedTable.id,
    sendToKitchen: true,
    discountAmount: totalDiscount > 0 ? totalDiscount : undefined,
    items: allItems.map((i) => ({
      productId: i.productId,
      quantity: i.quantity || i.qty || 1,
      menuType: i.menuType || 'UNIVERSITARIO',
      productName: i.name || undefined,
      toppings: (i.toppings || []).map((t) => ({
        toppingId: t.toppingId || t.id,
        quantity: t.quantity || 1,
      })),
      notes: i.notes || undefined,
    })),
    beverages: orderBeverages,
    notes: allNotes || undefined,
  };


  try {
    await tablesService.createTableOrder(selectedTable.id, payload);
    const modal = document.getElementById("waiter-order-modal");
    toggleMobileCart(false);
    if (modal) modal.style.display = "none";

    // Recargar mesas y reabrir detalle
    await loadTables();
    openTableDetail(selectedTable.id);
  } catch (err) {
    alert("Error al enviar comanda: " + err.message);
    btn.disabled = false;
    btn.textContent = "🚀 CONFIRMAR Y ENVIAR A COCINA";
  }
}

function setupEventListeners() {
  document.getElementById("btn-close-detail")?.addEventListener("click", closeTableDetail);
  document.getElementById("btn-close-order")?.addEventListener("click", closeOrderTaking);
  document.getElementById("btn-close-transfer")?.addEventListener("click", () => {
    const m = document.getElementById("waiter-transfer-modal");
    if (m) m.style.display = "none";
  });
}

function setupWebSocket() {
  if (wsSubscribed) return;
  wsSubscribed = true;

  wsService.on("TABLE_STATUS_CHANGED", (data) => {
    // Actualizar mesa en el estado local
    const idx = tables.findIndex((t) => t.id === data.tableId);
    if (idx !== -1) {
      tables[idx].status = data.status;
      tables[idx].accountRequested = data.accountRequested;
      renderTablesGrid();
      updateSummary();

      if (selectedTable && selectedTable.id === data.tableId) {
        selectedTable.status = data.status;
        selectedTable.accountRequested = data.accountRequested;
        openTableDetail(selectedTable.id);
      }
    } else {
      loadTables();
    }
  });

  globalThis.addEventListener('payment:completed', (e) => {
    const tableId = e.detail?.tableId;
    loadTables();
    if (selectedTable && (!tableId || selectedTable.id === tableId)) {
      tablesService.getTableOrders(selectedTable.id, true).then((res) => {
        activeOrders = res.data || [];
        renderTableDetailBody();
      });
    }
  });

  wsService.on("ORDER_STATUS_CHANGED", () => {
    if (selectedTable) {
      tablesService.getTableOrders(selectedTable.id, true).then((res) => {
        activeOrders = res.data || [];
        renderTableDetailBody();
      });
    }
    loadTables();
  });

  wsService.on("ORDER_CREATED", () => {
    loadTables();
    if (selectedTable) {
      tablesService.getTableOrders(selectedTable.id, true).then((res) => {
        activeOrders = res.data || [];
        renderTableDetailBody();
      });
    }
  });

  wsService.on("status_change", (status) => {
    const badge = document.getElementById("waiter-ws-status");
    if (badge) {
      if (status === "connected") {
        badge.textContent = "🟢 En vivo";
        badge.className = "waiter-badge-ws ws-connected";
      } else if (status === "connecting") {
        badge.textContent = "🟡 Reconectando...";
        badge.className = "waiter-badge-ws ws-connecting";
      } else {
        badge.textContent = "⚪ Sin conexión";
        badge.className = "waiter-badge-ws ws-disconnected";
      }
    }
  });
}

// ─── Modal de Promo para el Mesero ───────────────────────────────────────────
// A diferencia del POS, agrega al waiterCart (no al store global).
async function openWaiterPromoModal(promo) {
  let toppings = [];
  try {
    for (const pid of [1, 2, 3]) {
      const t = await catalogService.getProductToppings(pid);
      if (t && t.length > 0) {
        toppings = t.filter(tp => !tp.name.toLowerCase().includes("combo universitario"));
        break;
      }
    }
  } catch { /* sin toppings */ }

  const requiresBev = Boolean(promo.requiresBeverage);
  let beverages = [];
  let selectedBeverageId = null;
  if (requiresBev) {
    try {
      const allBevs = await catalogService.getBeverages();
      const activeBevs = (allBevs || []).filter(b => b.isActive !== false);
      
      if (promo.id === 'promo-2') {
        beverages = activeBevs.filter(b => {
          const n = b.name.toLowerCase();
          return (n.includes('coca') || n.includes('postob')) && n.includes('250');
        });
      } else {
        beverages = activeBevs;
      }
    } catch {
      beverages = [];
    }
  }

  const selected = new Set();
  const MAX = promo.maxToppings || 0;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  let domInitialized = false;

  function initDOM() {
    if (domInitialized) return;

    overlay.innerHTML = `
      <div class="modal promo-modal" style="max-width:500px;">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">${promo.icon || '🔥'} ${promo.name}</h2>
            <p style="font-size:var(--text-xs);color:var(--text-muted);margin-top:2px">${promo.description || ''}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-icon" id="wpm-close">✕</button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
          <div class="promo-price-banner">
            <span class="promo-badge">🔥 PROMOCIÓN</span>
            <span class="promo-price-display">${formatCurrency(promo.price)}</span>
          </div>
          ${promo.includes && promo.includes.length > 0 ? `
            <div class="promo-includes-bar">
              ${promo.includes.map(inc => `<span class="promo-include-chip">✅ ${inc}</span>`).join("")}
            </div>
          ` : ""}
          ${requiresBev ? `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
                <p style="font-size:var(--text-xs);font-weight:700;color:var(--text-secondary);text-transform:uppercase">
                  🥤 Gaseosa incluida <span style="color:#F87171">*</span>
                </p>
                <span id="wpm-bev-status" style="font-size:var(--text-xs);font-weight:600;color:#F87171">
                  ⚠️ Requerida
                </span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));gap:6px">
                ${beverages.map(b => {
                  return `
                    <button type="button" class="btn btn-sm btn-secondary btn-promo-bev"
                            data-bev-id="${b.id}" data-name="${b.name}" style="justify-content:flex-start;text-align:left;white-space:normal;padding:6px 10px;">
                      <span>⚪ ${b.name}</span>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}
          ${toppings.length > 0 && MAX > 0 ? `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
                <p style="font-size:var(--text-xs);font-weight:700;color:var(--text-secondary);text-transform:uppercase">
                  Toppings incluidos (sin costo)
                </p>
                <span class="promo-topping-counter">0 / ${MAX}</span>
              </div>
              <div class="toppings-selection-grid">
                ${toppings.map(t => `
                  <button type="button" class="topping-chip-btn" data-id="${t.id}">
                    <span class="tc-name">${t.name}</span>
                    <span class="tc-price">Incluido</span>
                  </button>
                `).join("")}
              </div>
            </div>
          ` : ""}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="wpm-cancel">Cancelar</button>
          <button type="button" class="btn btn-primary btn-lg" id="wpm-confirm" style="flex:1" disabled>
            🔥 Agregar — ${formatCurrency(promo.price)}
          </button>
        </div>
      </div>
    `;

    overlay.querySelector("#wpm-close").onclick = () => overlay.remove();
    overlay.querySelector("#wpm-cancel").onclick = () => overlay.remove();

    if (requiresBev) {
      overlay.querySelectorAll(".btn-promo-bev").forEach((btn) => {
        btn.onclick = () => {
          selectedBeverageId = Number(btn.dataset.bevId);
          draw();
        };
      });
    }

    overlay.querySelectorAll(".topping-chip-btn").forEach((btn) => {
      btn.onclick = () => {
        if (btn.disabled) return;
        const id = Number(btn.dataset.id);
        if (selected.has(id)) {
          selected.delete(id);
        } else {
          if (MAX > 0 && selected.size >= MAX) return;
          selected.add(id);
        }
        draw();
      };
    });

    overlay.querySelector("#wpm-confirm").onclick = () => {
      if (requiresBev && !selectedBeverageId) {
        alert("⚠️ Por favor selecciona una gaseosa para continuar.");
        return;
      }

      const selectedBev = beverages.find((b) => b.id === selectedBeverageId) || null;
      const selToppings = toppings
        .filter((t) => selected.has(t.id))
        .map((t) => ({
          toppingId: t.id,
          name: t.name,
          quantity: 1,
          extraPrice: 0,
          unitPrice: 0,
        }));

      const notesParts = [];
      if (promo.includes && promo.includes.length > 0) {
        notesParts.push(`[Incluye: ${promo.includes.join(", ")}]`);
      }
      if (selectedBev) {
        notesParts.push(`[Bebida: ${selectedBev.name}]`);
      }

      waiterCart.items.push({
        productId: promo.productId || 3,
        promoId: promo.id,
        name: promo.name,
        quantity: 1,
        menuType: "UNIVERSITARIO",
        unitPrice: promo.price,
        toppings: selToppings,
        notes: notesParts.length ? notesParts.join(" ") : undefined,
        _isPromo: true,
        _promoBeverage: selectedBev ? { beverageId: selectedBev.id, name: selectedBev.name } : undefined,
      });

      overlay.remove();
      refreshWaiterCartUI();
    };

    domInitialized = true;
  }

  function draw() {
    initDOM();

    const count = selected.size;
    const atMax = MAX > 0 && count >= MAX;
    const canConfirm = !requiresBev || Boolean(selectedBeverageId);

    if (requiresBev) {
      overlay.querySelectorAll(".btn-promo-bev").forEach((btn) => {
        const bId = Number(btn.dataset.bevId);
        const bName = btn.dataset.name;
        const isSel = selectedBeverageId === bId;
        btn.className = `btn btn-sm ${isSel ? 'btn-primary' : 'btn-secondary'} btn-promo-bev`;
        btn.innerHTML = `<span>${isSel ? '🔘' : '⚪'} ${bName}</span>`;
      });
      const bevStatus = overlay.querySelector("#wpm-bev-status");
      if (bevStatus) {
        bevStatus.style.color = selectedBeverageId ? '#34D399' : '#F87171';
        bevStatus.innerText = selectedBeverageId ? '✅ Seleccionada' : '⚠️ Requerida';
      }
    }

    const counter = overlay.querySelector(".promo-topping-counter");
    if (counter) {
      counter.innerText = `${count} / ${MAX}`;
      if (atMax) counter.classList.add("counter-full");
      else counter.classList.remove("counter-full");
    }

    overlay.querySelectorAll(".topping-chip-btn").forEach((btn) => {
      const id = Number(btn.dataset.id);
      const isSel = selected.has(id);
      const isDisabled = !isSel && atMax;
      
      btn.className = `topping-chip-btn${isSel ? " selected" : ""}${isDisabled ? " disabled" : ""}`;
      btn.disabled = isDisabled;
    });

    const confirmBtn = overlay.querySelector("#wpm-confirm");
    if (confirmBtn) {
      confirmBtn.disabled = !canConfirm;
    }
  }

  draw();
  document.body.appendChild(overlay);
}

/**
 * pos.js — Vista principal del Punto de Venta
 * Conecta con: GET /api/v1/catalog/categories y /api/v1/catalog/products
 */
import { store, addProductToCart } from '../store/state.js';
import { catalogService } from '../services/catalog.service.js';
import { renderCart } from './cart.js';
import { openPaymentModal } from './paymentModal.js';
import { openToppingModal } from './toppingModal.js';
import { toast } from '../utils/notify.js';
import { formatCurrency } from '../utils/currency.js';
import { CONFIG } from '../config.js';
import { tablesService } from '../services/tables.service.js';
import { wsService } from '../services/websocket.service.js';
import { renderPromos, PROMOTIONS, renderPromoCard, openPromoModal } from './promos.js';

let checkoutInProgress = false;


export async function renderPos(container) {
  container.innerHTML = `
    <div class="pos-layout">
      <!-- Panel de Productos -->
      <div class="products-panel" id="products-panel">
        <div class="products-panel-header">
          <!-- Toolbar: búsqueda + tipo de menú -->
          <div class="products-panel-toolbar">
            <div class="search-wrap" style="flex:1">
              <span class="search-icon">🔍</span>
              <input class="input input-search" id="pos-search"
                     placeholder="Buscar producto o SKU..." autocomplete="off" />
            </div>
            <div class="menu-type-selector">
              <button class="menu-type-btn active" data-menu="AMBOS">Todos</button>
              <button class="menu-type-btn" data-menu="UNIVERSITARIO">Uni.</button>
              <button class="menu-type-btn" data-menu="ESPECIAL">Especial</button>
            </div>
          </div>

          <!-- Tabs de categorías -->
          <div class="category-tabs" id="category-tabs">
            <button class="category-tab tab-promos" data-cat-id="promos">🔥 PROMOS</button>
            <button class="category-tab active" data-cat-id="all">🍽️ Todos</button>
            <!-- Se cargan dinámicamente -->
          </div>

          <!-- Resumen Compacto de Mesas en Caja (Bloque 4) -->
          <div class="pos-tables-compact-bar" id="pos-tables-summary-bar">
            <span class="compact-chip chip-libre">🟢 <span id="pos-count-libres">7</span> Libres</span>
            <span class="compact-chip chip-ocupada">🔴 <span id="pos-count-ocupadas">0</span> Ocupadas</span>
            <span class="compact-chip chip-cuenta" id="pos-chip-cuenta" style="display:none; cursor:pointer;" title="Haga clic para ver y cobrar mesas con cuenta solicitada">🔔 <span id="pos-count-cuentas">0</span> Cuenta solicitada</span>
          </div>
        </div>

        <!-- Título móvil inyectado justo antes de los productos -->
        <h2 class="mobile-pos-title" style="display:none;">🔥 Punto de Venta</h2>

        <!-- Grid de productos -->
        <div class="product-grid" id="product-grid">
          ${renderSkeletons(8)}
        </div>
      </div>

      <!-- Panel del Carrito (se monta aquí) -->
      <div id="cart-mount"></div>
    </div>
  `;

  // Montar el carrito
  renderCart(container.querySelector('#cart-mount'));

  // Resetear flag de checkout al montar un container nuevo.
  // Si el usuario navegó mientras había un checkout en curso, el proceso quedó
  // huérfano (el DOM ya no existe); resetear aquí es seguro y necesario.
  checkoutInProgress = false;

  // Registrar listeners de checkout exactamente una vez POR CONTAINER.
  // Se usa una propiedad del propio elemento DOM en lugar de una variable de módulo,
  // para que cada container nuevo (creado al volver al POS) reciba sus listeners.
  if (!container.__checkoutListenersBound) {
    container.addEventListener('pos:sendOnly', () => handleCheckout(false));
    container.addEventListener('pos:sendAndPay', () => handleCheckout(true));
    container.__checkoutListenersBound = true;
  }

  // Delegación de eventos para click en "Cuenta solicitada" (disponible inmediatamente)
  container.addEventListener('click', (e) => {
    const chip = e.target.closest('#pos-chip-cuenta');
    if (chip) {
      e.preventDefault();
      openCuentasSolicitadasModal(container);
    }
  });

  async function handleCheckout(shouldPay) {
    // Guard against concurrent checkouts
    if (checkoutInProgress) {
      console.warn('Checkout already in progress');
      return;
    }
    checkoutInProgress = true;

    // Disable checkout buttons to give visual feedback
    const btnSendOnly = container.querySelector('#btn-send-only');
    const btnSendAndPay = container.querySelector('#btn-send-and-pay');
    const btnMobileSendOnly = container.querySelector('#btn-mobile-send-only');
    const btnMobileSendAndPay = container.querySelector('#btn-mobile-send-and-pay');
    [btnSendOnly, btnSendAndPay, btnMobileSendOnly, btnMobileSendAndPay].forEach(b => {
      if (b) b.disabled = true;
    });
    const cart = store.get('cart');

    // 1. Si el flujo es COBRAR, validar caja ABIERTA ANTES de crear el pedido en backend
    if (shouldPay) {
      const cashSession = store.get('cashSession');
      if (!cashSession || !cashSession.id) {
        toast.error('⚠️ No hay sesión de caja activa. Abre la caja en la sección 💰 Caja antes de cobrar.');
        return;
      }
    }
    
    // 2. Crear el pedido
    const orderBeverages = (cart.beverages || []).map(b => ({ beverageId: b.beverageId, quantity: b.qty }));
    (cart.items || []).forEach(i => {
      if (i._promoBeverage && i._promoBeverage.beverageId) {
        orderBeverages.push({
          beverageId: i._promoBeverage.beverageId,
          quantity: i.qty || 1,
          overridePrice: 0,
        });
      }
    });

    const orderDTO = {
      orderType:       cart.orderType,
      customerId:      cart.customerId || (cart.customer ? cart.customer.id : null),
      tableId:         cart.orderType === 'MESA' ? cart.tableId : null,
      deliveryAddress: cart.orderType === 'DOMICILIO' ? (cart.deliveryAddress || '').trim() : null,
      notes:           cart.notes || null,
      taxPercentage:   0,
      discountAmount:  cart.discountAmount || 0,
      sendToKitchen:   true, // Envía a cocina independientemente de si se paga ahora
      items: cart.items.map(i => ({
        productId: i.productId,
        quantity:  i.qty,
        menuType:  i.menuType,
        productName: i.name,
        toppings:  (i.toppings || []).map(t => ({
          toppingId: t.toppingId,
          quantity:  t.quantity || 1,
        })),
      })),
      beverages: orderBeverages,
      combos:    cart.combos.map(c   => ({ comboId: c.comboId, quantity: c.qty })),
    };

    try {
      const { ordersService } = await import('../services/orders.service.js');
      const { clearCart } = await import('../store/state.js');
      const order = await ordersService.createOrder(orderDTO);
      const snapshot = { ...cart };

      if (!shouldPay) {
        const displayLabel = order.dailyOrderNumber ? `PEDIDO ${order.dailyOrderNumber}` : `Pedido #${order.orderNumber}`;
        toast.success(`✅ ${displayLabel} enviado a cocina`);
        clearCart();
        loadPosTablesSummary(container);
      } else {
        clearCart();
        await openPaymentModal(order, snapshot);
        loadPosTablesSummary(container);
      }
    } catch (err) {
      toast.error(`Error al crear pedido: ${err.message}`);
    } finally {
      // Re‑enable checkout buttons and reset flag
      const btnSendOnly = container.querySelector('#btn-send-only');
      const btnSendAndPay = container.querySelector('#btn-send-and-pay');
      const btnMobileSendOnly = container.querySelector('#btn-mobile-send-only');
      const btnMobileSendAndPay = container.querySelector('#btn-mobile-send-and-pay');
      [btnSendOnly, btnSendAndPay, btnMobileSendOnly, btnMobileSendAndPay].forEach(b => {
        if (b) b.disabled = false;
      });
      checkoutInProgress = false;
    }
  }
  // Cargar datos en paralelo; los errores individuales se manejan internamente
  await Promise.all([
    loadCategories(container),
    loadProducts(container),
    loadPosTablesSummary(container),
  ]);

  // Eventos de interacción
  bindPosEvents(container);

  // Escuchar cambios de mesa en tiempo real
  wsService.on('TABLE_STATUS_CHANGED', () => {
    loadPosTablesSummary(container);
  });

  globalThis.addEventListener('payment:completed', () => {
    loadPosTablesSummary(container);
  });
}

// ─── Carga del resumen de mesas (barra compacta) ──────────────────────────────
async function loadPosTablesSummary(container) {
  try {
    const res = await tablesService.getTables();
    const tables = res.data || [];
    const libres   = tables.filter(t => t.status === 'LIBRE').length;
    const ocupadas = tables.filter(t => t.status === 'OCUPADA').length;
    const cuentas  = tables.filter(t => t.accountRequested).length;

    const elLibres  = container.querySelector('#pos-count-libres');
    const elOcupadas = container.querySelector('#pos-count-ocupadas');
    const elCuentas = container.querySelector('#pos-count-cuentas');
    const chipCuenta = container.querySelector('#pos-chip-cuenta');

    if (elLibres)   elLibres.textContent  = libres;
    if (elOcupadas) elOcupadas.textContent = ocupadas;
    if (elCuentas)  elCuentas.textContent  = cuentas;
    if (chipCuenta) chipCuenta.style.display = cuentas > 0 ? 'inline-flex' : 'none';
  } catch (err) {
    console.error('Error al cargar resumen de mesas en POS:', err);
  }
}

// ─── Carga de categorías ──────────────────────────────────────────────────────
async function loadCategories(container) {
  const tabsEl = container.querySelector('#category-tabs');
  try {
    const categories = await catalogService.getCategories();
    store.set({ categories });
    renderCategoryTabs(tabsEl, categories);
  } catch {
    toast.warning('No se pudieron cargar las categorías');
  }
}

// ─── Carga de productos ───────────────────────────────────────────────────────
async function loadProducts(container) {
  const gridEl = container.querySelector('#product-grid');
  try {
    const products = await catalogService.getProducts();
    store.set({ products });
    // Renderizar productos + promos (en la vista "Todos" aparecen ambos)
    renderAllInGrid(gridEl, products, store.get('menuType'), '');
  } catch (err) {
    console.error('Error cargando productos:', err);
    gridEl.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">😕</div>
        <p>No se pudieron cargar los productos.<br>Verifica que el servidor esté corriendo.</p>
      </div>`;
  }
}

// ─── Renderizar tabs de categorías ───────────────────────────────────────────
function renderCategoryTabs(tabsEl, categories) {
  const extra = categories.map(c => {
    const icon = CONFIG.CATEGORY_ICONS[c.name] || '🍽️';
    return `<button class="category-tab" data-cat-id="${c.id}">${icon} ${c.name}</button>`;
  }).join('');

  // Pestaña PROMOS siempre primera, luego "Todos", luego categorías
  tabsEl.innerHTML = `
    <button class="category-tab tab-promos" data-cat-id="promos">🔥 PROMOS</button>
    <button class="category-tab active" data-cat-id="all">🍽️ Todos</button>
    ${extra}
  `;
}

// ─── renderAllInGrid: productos + promos juntos (vista "Todos") ───────────────
/**
 * En la pestaña "Todos", muestra primero las promos y luego todos los productos.
 */
function renderAllInGrid(gridEl, products, menuType, search) {
  const query = search.toLowerCase().trim();

  const filtered = products.filter(p => {
    if (menuType !== 'AMBOS') {
      if (p.availableIn !== 'AMBOS' && p.availableIn !== menuType) return false;
    }
    if (query) {
      return p.name.toLowerCase().includes(query) ||
             (p.sku || '').toLowerCase().includes(query) ||
             (p.description || '').toLowerCase().includes(query);
    }
    return true;
  });

  // Construir HTML: sección de promos arriba + productos abajo
  const promosHtml = buildPromoCardsHtml();
  const productsHtml = filtered.length > 0
    ? filtered.map(p => renderProductCard(p, menuType)).join('')
    : '';

  if (!promosHtml && !productsHtml) {
    gridEl.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔍</div>
        <p>No se encontraron productos${query ? ` para "${search}"` : ''}</p>
      </div>`;
    return;
  }

  // Insertar promos (encabezado separado) + productos en el mismo grid
  gridEl.innerHTML = `
    ${promosHtml}
    ${productsHtml}
  `;
}

// ─── renderProductGrid: solo productos (usado en filtros de categoría) ────────
function renderProductGrid(gridEl, products, menuType, search) {
  const query = search.toLowerCase().trim();

  const filtered = products.filter(p => {
    if (menuType !== 'AMBOS') {
      if (p.availableIn !== 'AMBOS' && p.availableIn !== menuType) return false;
    }
    if (query) {
      return p.name.toLowerCase().includes(query) ||
             (p.sku || '').toLowerCase().includes(query) ||
             (p.description || '').toLowerCase().includes(query);
    }
    return true;
  });

  if (!filtered.length) {
    gridEl.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔍</div>
        <p>No se encontraron productos${query ? ` para "${search}"` : ''}</p>
      </div>`;
    return;
  }

  gridEl.innerHTML = filtered.map(p => renderProductCard(p, menuType)).join('');
}

// ─── Generar HTML de tarjetas de promo para insertar en el grid ───────────────
/**
 * Construye el bloque HTML de promos para insertar dentro del product-grid.
 * Usa grid-column: 1/-1 para el encabezado y luego un sub-grid de promos.
 */
function buildPromoCardsHtml() {
  const promoCards = PROMOTIONS.map(p => renderPromoCard(p, false)).join('');
  return `
    <div class="promos-in-grid-header" style="grid-column:1/-1">
      <span class="promos-label" style="font-size:var(--text-base)">🔥 PROMOCIONES</span>
      <span class="promos-sub">Precios especiales · Toppings incluidos</span>
    </div>
    <div class="promos-in-grid-container" style="grid-column:1/-1">
      <div class="promos-grid">
        ${promoCards}
      </div>
    </div>
    <div class="products-in-grid-divider" style="grid-column:1/-1">
      <span>🍽️ Productos</span>
    </div>
  `;
}

// ─── Tarjeta de producto ──────────────────────────────────────────────────────
function renderProductCard(product, menuType) {
  let price;
  if (menuType === 'UNIVERSITARIO') price = product.priceUniversitario ?? product.priceEspecial;
  else if (menuType === 'ESPECIAL')  price = product.priceEspecial ?? product.priceUniversitario;
  else                               price = product.priceEspecial ?? product.priceUniversitario;

  const availBadge = product.availableIn !== 'AMBOS'
    ? `<span class="badge ${product.availableIn === 'ESPECIAL' ? 'badge-amber' : 'badge-green'}" style="font-size:10px">${product.availableIn === 'UNIVERSITARIO' ? '🎓 Uni' : '⭐ Especial'}</span>`
    : '';

  const categoryIcon = CONFIG.CATEGORY_ICONS[product.categoryName] || '🍔';

  return `
    <div class="product-card${!product.isActive ? ' inactive' : ''}"
         data-product-id="${product.id}"
         role="button"
         tabindex="0"
         aria-label="Agregar ${product.name} al pedido">
      <div class="card-image-wrap${!product.imageUrl ? ' no-image' : ''}">
        ${product.imageUrl
          ? `<img src="${product.imageUrl}" alt="${product.name}" loading="lazy"
                  onerror="this.style.display='none'; this.closest('.card-image-wrap').classList.add('no-image'); if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
             <div class="card-image-placeholder" style="display:none">
               <span class="placeholder-icon">${categoryIcon}</span>
               ${availBadge ? `<div class="placeholder-badge-wrap">${availBadge}</div>` : ''}
             </div>`
          : `<div class="card-image-placeholder">
               <span class="placeholder-icon">${categoryIcon}</span>
               ${availBadge ? `<div class="placeholder-badge-wrap">${availBadge}</div>` : ''}
             </div>`
        }
        ${availBadge ? `<div class="badge-availability">${availBadge}</div>` : ''}
      </div>
      <div class="card-body">
        <p class="card-name">${product.name}</p>
        ${product.description ? `<p class="card-description">${product.description}</p>` : ''}
      </div>
      <div class="card-footer">
        <span class="card-price">${formatCurrency(price)}</span>
        <button class="card-add-btn" data-product-id="${product.id}" title="Agregar al pedido">+</button>
      </div>
    </div>
  `;
}

// ─── Eventos del POS ──────────────────────────────────────────────────────────
function bindPosEvents(container) {
  const gridEl   = container.querySelector('#product-grid');
  const searchEl = container.querySelector('#pos-search');
  const tabsEl   = container.querySelector('#category-tabs');

  let currentCatId = 'all';
  let currentMenu  = store.get('menuType') || 'AMBOS';
  let searchTimeout = null;

  // ── Click en tarjeta de producto ─────────────────────────────────────────
  gridEl.addEventListener('click', async (e) => {
    // Tarjeta de promo
    const promoCard = e.target.closest('.promo-card');
    if (promoCard) {
      const promoId = promoCard.dataset.promoId;
      const promo   = PROMOTIONS.find(p => p.id === promoId);
      if (!promo) return;
      await openPromoModal(promo);
      return;
    }

    // Tarjeta de producto normal
    const card   = e.target.closest('.product-card:not(.inactive)');
    const addBtn = e.target.closest('.card-add-btn');
    if (!card && !addBtn) return;

    const productId = Number((card || addBtn).dataset.productId || card?.dataset.productId);
    const products  = store.get('products');
    const product   = products.find(p => p.id === productId);
    if (!product) return;

    if (product.hasToppings) {
      openToppingModal(product, currentMenu);
    } else {
      addProductToCart(product, currentMenu, []);
      toast.success(`${product.name} agregado 🔥`, 1800);
    }
  });

  // ── Teclado en tarjetas ───────────────────────────────────────────────────
  gridEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.target.closest('.product-card')?.click();
    }
  });

  // ── Búsqueda con debounce ─────────────────────────────────────────────────
  searchEl.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = e.target.value;
      store.set({ searchQuery: query });
      if (currentCatId === 'all') {
        renderAllInGrid(gridEl, store.get('products'), currentMenu, query);
      } else if (currentCatId !== 'promos') {
        renderProductGrid(gridEl, store.get('products'), currentMenu, query);
      }
    }, 250);
  });

  // ── Selección de categoría ────────────────────────────────────────────────
  tabsEl.addEventListener('click', async (e) => {
    const tab = e.target.closest('.category-tab');
    if (!tab) return;

    tabsEl.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentCatId = tab.dataset.catId;

    // Pestaña "Todos": productos + promos
    if (currentCatId === 'all') {
      gridEl.innerHTML = renderSkeletons(8);
      try {
        const products = await catalogService.getProducts();
        store.set({ products });
        renderAllInGrid(gridEl, products, currentMenu, searchEl.value);
      } catch {
        toast.error('Error al cargar productos');
      }
      return;
    }

    // Pestaña especial de Promociones
    if (currentCatId === 'promos') {
      gridEl.innerHTML = '';
      renderPromos(gridEl);
      return;
    }

    // Pestaña de categoría específica: solo productos
    gridEl.innerHTML = renderSkeletons(8);
    try {
      const products = await catalogService.getProducts({ categoryId: Number(currentCatId) });
      store.set({ products });
      renderProductGrid(gridEl, products, currentMenu, searchEl.value);
    } catch {
      toast.error('Error al filtrar productos');
    }
  });

  // ── Tipo de menú (Todos / Uni. / Especial) ────────────────────────────────
  container.querySelector('.menu-type-selector')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.menu-type-btn');
    if (!btn) return;
    container.querySelectorAll('.menu-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMenu = btn.dataset.menu;
    store.set({ menuType: currentMenu });

    if (currentCatId === 'all') {
      renderAllInGrid(gridEl, store.get('products'), currentMenu, searchEl.value);
    } else if (currentCatId !== 'promos') {
      renderProductGrid(gridEl, store.get('products'), currentMenu, searchEl.value);
    }
  });
}

// ─── Modal de Cuentas Solicitadas ─────────────────────────────────────────────
async function openCuentasSolicitadasModal(container) {
  try {
    const res = await tablesService.getTables();
    const tables = (res.data || []).filter(t => t.accountRequested && t.status === 'OCUPADA');

    if (tables.length === 0) {
      toast.info('No hay mesas con cuenta solicitada en este momento.');
      loadPosTablesSummary(container);
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-cuentas-solicitadas';
    overlay.style.zIndex = '1100';
    overlay.style.pointerEvents = 'auto';

    overlay.innerHTML = `
      <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">🔔 Cuentas Solicitadas</h2>
            <p style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px;">
              Mesas que han solicitado la cuenta para pago
            </p>
          </div>
          <button class="btn btn-ghost btn-icon" id="btn-close-cuentas">✕</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4);">
          ${tables.map(table => `
            <div class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px;">
              <div>
                <strong style="font-size: 1rem; color: var(--text-primary);">${table.name}</strong>
                <span class="badge badge-amber" style="margin-left: 8px; font-size: 11px;">Cuenta Solicitada</span>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                  Zona: ${table.zoneName || 'General'}
                </div>
              </div>
              <button class="btn btn-primary btn-sm btn-cobrar-cuenta" data-table-id="${table.id}" data-table-name="${table.name}">
                💳 Cobrar
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    overlay.querySelector('#btn-close-cuentas').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.querySelectorAll('.btn-cobrar-cuenta').forEach(btn => {
      btn.onclick = async () => {
        const tableId = Number(btn.dataset.tableId);
        const tableName = btn.dataset.tableName;

        // Validar caja abierta
        const cashSession = store.get('cashSession');
        if (!cashSession || !cashSession.id) {
          toast.error('⚠️ No hay sesión de caja activa. Abre la caja en la sección 💰 Caja antes de cobrar.');
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Cargando...';

        try {
          // Obtener los pedidos activos de la mesa
          const ordersRes = await tablesService.getTableOrders(tableId, true);
          const activeOrders = ordersRes.data || [];

          if (activeOrders.length === 0) {
            toast.warning(`La ${tableName} no tiene pedidos activos pendientes de cobro.`);
            overlay.remove();
            loadPosTablesSummary(container);
            return;
          }

          // Tomar el pedido activo no pagado de la mesa
          const order = activeOrders[activeOrders.length - 1];
          overlay.remove();

          // Abrir flujo de cobro real con la orden existente (NO crea pedido duplicado)
          await openPaymentModal(order, null);

          // Al cerrarse el modal de pago o terminar, refrescar resumen
          loadPosTablesSummary(container);
        } catch (err) {
          toast.error(`Error al cargar cuenta de ${tableName}: ${err.message}`);
          btn.disabled = false;
          btn.textContent = '💳 Cobrar';
        }
      };
    });

    document.body.appendChild(overlay);
  } catch (err) {
    toast.error(`Error al consultar cuentas solicitadas: ${err.message}`);
  }
}

// ─── Skeletons de carga ───────────────────────────────────────────────────────
function renderSkeletons(n) {
  return Array(n).fill(`
    <div class="product-card" style="pointer-events:none">
      <div class="card-image-wrap skeleton"></div>
      <div class="card-body" style="gap:var(--space-2)">
        <div class="skeleton" style="height:14px;width:80%;border-radius:4px"></div>
        <div class="skeleton" style="height:11px;width:60%;border-radius:4px"></div>
      </div>
      <div class="card-footer">
        <div class="skeleton" style="height:18px;width:60px;border-radius:4px"></div>
        <div class="skeleton" style="height:30px;width:30px;border-radius:var(--radius-md)"></div>
      </div>
    </div>
  `).join('');
}

/**
 * customerOrder.js — Interfaz Móvil de Pedidos para Clientes de Ardientes POS
 * 
 * Totalmente aislado del cliente HTTP de colaboradores (api.service.js).
 * Consulta el catálogo utilizando el token de cliente (ardientes_customer_token)
 * y gestiona un carrito 100% independiente (customerCart).
 */
import { customerAuthService } from '../services/customerAuth.service.js';
import { CONFIG } from '../config.js';
import { PROMOTIONS } from './promos.js';
import { formatCurrency } from '../utils/currency.js';
import { toast } from '../utils/notify.js';

// Estado local del carrito de cliente
let customerCart = {
  items: [],
};

export function getCustomerCart() {
  return customerCart;
}

export function clearCustomerCart() {
  customerCart.items = [];
}

/**
 * Cliente HTTP aislado exclusivo para consultas del cliente.
 * Adjunta 'ardientes_customer_token' y NUNCA dispara 'auth:unauthorized' de colaboradores.
 */
async function fetchCustomerCatalog(path) {
  const token = customerAuthService.getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${CONFIG.API_BASE}${path}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    let errorMsg = `Error ${response.status}`;
    try {
      const payload = await response.json();
      errorMsg = payload?.error?.message || payload?.message || errorMsg;
    } catch {
      /* no JSON */
    }

    // Manejo de 401 exclusivo para sesión de cliente
    if (response.status === 401) {
      customerAuthService.clearSession();
      throw new Error('Sesión de cliente expirada. Por favor ingresa nuevamente.');
    }
    throw new Error(errorMsg);
  }

  const json = await response.json();
  return json.data ?? [];
}

/**
 * Renderiza la interfaz principal de pedidos para el cliente.
 * @param {HTMLElement} container - Contenedor donde se montará la vista.
 * @param {object} options - { onBack } callback para regresar al portal.
 */
export async function renderCustomerOrder(container, { onBack } = {}) {
  // Carga inicial del catálogo usando la vía aislada del cliente
  let categories = [];
  let products = [];
  try {
    const [cats, prods] = await Promise.all([
      fetchCustomerCatalog('/api/v1/catalog/categories'),
      fetchCustomerCatalog('/api/v1/catalog/products'),
    ]);
    categories = cats || [];
    products = prods || [];
  } catch (err) {
    toast.error(err.message || 'Error al cargar el catálogo de productos');
  }

  // Estado interno de vista de pedidos
  let currentSection = null; // null (Hub), 'UNIVERSITARIO', 'ESPECIAL', 'PROMOS'
  let selectedCategoryId = null;

  function renderHub() {
    container.innerHTML = `
      <div class="customer-order-wrapper">
        <!-- Header Superior de Cliente -->
        <header class="customer-header">
          <button type="button" class="btn-customer-back" id="btn-order-home-back">
            <span>←</span>
            <span>Mi Perfil</span>
          </button>
          <div class="customer-header-title">
            <span class="customer-brand-fire">🔥 ARDIENTES</span>
            <span class="customer-brand-sub">HACER PEDIDO</span>
          </div>
          <div style="width: 70px;"></div>
        </header>

        <!-- Tarjetas Táctiles Principales -->
        <main class="customer-main-content">
          <div class="customer-welcome-banner">
            <h2>🛒 ¿Qué se te antoja hoy?</h2>
            <p>Selecciona una opción para explorar nuestro menú en línea</p>
          </div>

          <div class="customer-hub-grid">
            <!-- 🎓 MENÚ UNIVERSITARIO -->
            <div class="customer-hub-card hub-universitario" id="card-hub-universitario">
              <div class="hub-icon-wrapper">🎓</div>
              <div class="hub-info">
                <span class="hub-tag tag-econ">Económico</span>
                <h3 class="hub-title">MENÚ UNIVERSITARIO</h3>
                <p class="hub-sub">Productos tradicionales con hasta 4 toppings incluidos</p>
                <div class="hub-action-bar">
                  <span class="hub-rule">Máximo 4 toppings</span>
                  <button type="button" class="btn-hub-ver">VER MENÚ ➔</button>
                </div>
              </div>
            </div>

            <!-- ⭐ MENÚ ESPECIAL -->
            <div class="customer-hub-card hub-especial" id="card-hub-especial">
              <div class="hub-icon-wrapper">⭐</div>
              <div class="hub-info">
                <span class="hub-tag tag-esp">Premium</span>
                <h3 class="hub-title">MENÚ ESPECIAL</h3>
                <p class="hub-sub">Con porción de papas, toppings ilimitados y lluvia de queso gratinado 🧀</p>
                <div class="hub-action-bar">
                  <span class="hub-rule">Toppings ilimitados + Queso 🧀</span>
                  <button type="button" class="btn-hub-ver">VER MENÚ ➔</button>
                </div>
              </div>
            </div>

            <!-- 🔥 PROMOS -->
            <div class="customer-hub-card hub-promos" id="card-hub-promos">
              <div class="hub-icon-wrapper">🔥</div>
              <div class="hub-info">
                <span class="hub-tag tag-promo">Oferta</span>
                <h3 class="hub-title">PROMOS</h3>
                <p class="hub-sub">Combos, promociones activas y ofertas especiales de temporada</p>
                <div class="hub-action-bar">
                  <span class="hub-rule">Promociones activas</span>
                  <button type="button" class="btn-hub-ver">VER PROMOS ➔</button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <!-- Barra flotante de Carrito móvil -->
        ${renderFloatingCartBar()}
      </div>
    `;

    // Bind Hub events
    container.querySelector('#btn-order-home-back')?.addEventListener('click', () => {
      if (onBack) onBack();
    });

    container.querySelector('#card-hub-universitario')?.addEventListener('click', () => {
      currentSection = 'UNIVERSITARIO';
      selectedCategoryId = null;
      renderSection();
    });

    container.querySelector('#card-hub-especial')?.addEventListener('click', () => {
      currentSection = 'ESPECIAL';
      selectedCategoryId = null;
      renderSection();
    });

    container.querySelector('#card-hub-promos')?.addEventListener('click', () => {
      currentSection = 'PROMOS';
      renderSection();
    });

    bindCartBarEvents();
  }

  function renderSection() {
    let sectionTitle = '';
    let sectionRuleTag = '';
    let sectionBadgeClass = '';

    if (currentSection === 'UNIVERSITARIO') {
      sectionTitle = '🎓 Menú Universitario';
      sectionRuleTag = 'Máximo 4 toppings por producto';
      sectionBadgeClass = 'rule-econ';
    } else if (currentSection === 'ESPECIAL') {
      sectionTitle = '⭐ Menú Especial';
      sectionRuleTag = 'Toppings ilimitados + lluvia de queso gratinado 🧀';
      sectionBadgeClass = 'rule-esp';
    } else if (currentSection === 'PROMOS') {
      sectionTitle = '🔥 Promociones';
      sectionRuleTag = 'Promociones especiales y combos';
      sectionBadgeClass = 'rule-promo';
    }

    container.innerHTML = `
      <div class="customer-order-wrapper">
        <!-- Barra de Navegación de Sección -->
        <header class="customer-nav-subbar">
          <button type="button" class="btn-customer-back" id="btn-section-back">
            <span>←</span>
            <span>Menús</span>
          </button>
          <div class="section-title-wrap">
            <h2 class="section-title">${sectionTitle}</h2>
            <span class="section-rule-badge ${sectionBadgeClass}">${sectionRuleTag}</span>
          </div>
        </header>

        <!-- Contenido principal según la sección -->
        <main class="customer-main-content">
          ${currentSection === 'PROMOS' ? renderPromosSection() : renderCategoryAndProductsSection()}
        </main>

        <!-- Barra Flotante de Carrito Móvil -->
        ${renderFloatingCartBar()}
      </div>
    `;

    // Eventos de barra de navegación
    container.querySelector('#btn-section-back')?.addEventListener('click', () => {
      currentSection = null;
      renderHub();
    });

    if (currentSection !== 'PROMOS') {
      bindCategoryTabsEvents();
      bindProductCardsEvents();
    } else {
      bindPromosCardsEvents();
    }

    bindCartBarEvents();
  }

  function renderCategoryAndProductsSection() {
    const availableCategories = categories.filter((c) =>
      products.some((p) => p.categoryId === c.id && p.isActive && (p.availableIn === currentSection || p.availableIn === 'AMBOS'))
    );

    if (!selectedCategoryId || !availableCategories.some((c) => c.id === selectedCategoryId)) {
      selectedCategoryId = availableCategories[0]?.id || null;
    }

    const filteredProducts = products.filter(
      (p) => p.categoryId === selectedCategoryId && p.isActive && (p.availableIn === currentSection || p.availableIn === 'AMBOS')
    );

    return `
      <!-- Pestañas Horizontales de Categorías -->
      <div class="customer-categories-scroll">
        ${availableCategories.map((c) => `
          <button type="button" class="customer-cat-tab ${c.id === selectedCategoryId ? 'active' : ''}" data-cat-id="${c.id}">
            ${c.name}
          </button>
        `).join('')}
      </div>

      <!-- Grilla de Productos -->
      <div class="customer-products-grid">
        ${filteredProducts.length === 0 ? `
          <div class="customer-empty-products">
            <p>No hay productos disponibles en esta categoría para el menú seleccionado.</p>
          </div>
        ` : filteredProducts.map((p) => {
          const price = currentSection === 'ESPECIAL'
            ? (p.priceEspecial || p.priceUniversitario || 0)
            : (p.priceUniversitario || p.priceEspecial || 0);

          return `
            <div class="customer-product-card" data-product-id="${p.id}">
              <div class="product-card-top">
                <div class="product-card-info">
                  <h3 class="prod-title">${p.name}</h3>
                  ${p.description ? `<p class="prod-desc">${p.description}</p>` : ''}
                </div>
              </div>
              <div class="product-card-bottom">
                <span class="prod-price">${formatCurrency(price)}</span>
                <button type="button" class="btn-select-product" data-product-id="${p.id}">
                  + Seleccionar
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderPromosSection() {
    return `
      <div class="customer-promos-container">
        <div class="promos-intro-notice">
          <span>🔥</span>
          <p>Disfruta de nuestras promociones especiales preparadas al instante.</p>
        </div>
        <div class="customer-promos-grid">
          ${PROMOTIONS.map((promo) => `
            <div class="customer-promo-card" data-promo-id="${promo.id}">
              <div class="promo-card-badge">🔥 OFERTA</div>
              <div class="promo-card-icon-lg">${promo.icon}</div>
              <h3 class="promo-title">${promo.name}</h3>
              <p class="promo-desc">${promo.description}</p>
              ${promo.includes.length > 0 ? `
                <div class="promo-includes">
                  ${promo.includes.map(inc => `<span class="promo-inc-chip">✓ ${inc}</span>`).join('')}
                </div>
              ` : ''}
              <div class="promo-footer">
                <span class="promo-price">${formatCurrency(promo.price)}</span>
                <button type="button" class="btn-select-promo" data-promo-id="${promo.id}">
                  Ver Promo ➔
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function bindCategoryTabsEvents() {
    container.querySelectorAll('.customer-cat-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        selectedCategoryId = Number(tab.dataset.catId);
        renderSection();
      });
    });
  }

  function bindProductCardsEvents() {
    container.querySelectorAll('.customer-product-card, .btn-select-product').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = Number(el.dataset.productId || el.closest('.customer-product-card')?.dataset.productId);
        const product = products.find((p) => p.id === pid);
        if (product) openProductCustomizationModal(product, currentSection);
      });
    });
  }

  function bindPromosCardsEvents() {
    container.querySelectorAll('.customer-promo-card, .btn-select-promo').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const promoId = el.dataset.promoId || el.closest('.customer-promo-card')?.dataset.promoId;
        const promo = PROMOTIONS.find((p) => p.id === promoId);
        if (promo) {
          openCustomerPromoModal(promo);
        }
      });
    });
  }

  function renderFloatingCartBar() {
    const count = customerCart.items.reduce((s, i) => s + i.quantity, 0);
    const total = calculateCartTotal();

    if (count === 0) return '';

    return `
      <div class="customer-cart-floating-bar" id="customer-cart-bar">
        <div class="cart-bar-left">
          <span class="cart-bar-badge">🛒 ${count}</span>
          <div class="cart-bar-text">
            <span class="cart-bar-label">Tu Pedido</span>
            <span class="cart-bar-total">${formatCurrency(total)}</span>
          </div>
        </div>
        <button type="button" class="btn-view-cart" id="btn-open-cart-modal">
          VER PEDIDO ➔
        </button>
      </div>
    `;
  }

  function bindCartBarEvents() {
    container.querySelector('#btn-open-cart-modal')?.addEventListener('click', () => {
      openCustomerCartModal();
    });
  }

  function calculateCartTotal() {
    return customerCart.items.reduce((acc, item) => {
      let toppingExtra = (item.toppings || []).reduce((s, t) => s + (t.extraPrice || 0) * (t.quantity || 1), 0);
      return acc + (item.unitPrice + toppingExtra) * item.quantity;
    }, 0);
  }

  // ── Modal de Personalización de Producto ────────────────────────────────────
  async function openProductCustomizationModal(product, menuType) {
    let allowedToppings = [];
    try {
      allowedToppings = await fetchCustomerCatalog(`/api/v1/catalog/products/${product.id}/toppings`);
    } catch {
      allowedToppings = [];
    }

    const isEspecial = menuType === 'ESPECIAL';
    const isUniversitario = menuType === 'UNIVERSITARIO';
    const maxToppings = isUniversitario ? 4 : null;
    const basePrice = isEspecial
      ? (product.priceEspecial || product.priceUniversitario || 0)
      : (product.priceUniversitario || product.priceEspecial || 0);

    const selectedToppings = new Set();
    let quantity = 1;

    // Toppings especiales
    const cheeseTopping = allowedToppings.find(t => t.name.toLowerCase().includes('lluvia de queso'));
    if (isEspecial && cheeseTopping) {
      selectedToppings.add(cheeseTopping.id);
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'customer-modal-overlay';

    function drawCustomization() {
      const normalToppingsCount = Array.from(selectedToppings).filter(tid => {
        if (isEspecial && cheeseTopping && tid === cheeseTopping.id) return false;
        return true;
      }).length;

      const atMax = maxToppings !== null && normalToppingsCount >= maxToppings;
      const currentTotal = basePrice * quantity;

      modalOverlay.innerHTML = `
        <div class="customer-modal-card">
          <!-- Header -->
          <div class="cust-modal-header">
            <div>
              <span class="cust-modal-tag ${isEspecial ? 'tag-esp' : 'tag-econ'}">
                ${isEspecial ? '⭐ MENÚ ESPECIAL' : '🎓 MENÚ UNIVERSITARIO'}
              </span>
              <h2 class="cust-modal-title">${product.name}</h2>
            </div>
            <button type="button" class="btn-close-modal" id="btn-cust-modal-close">✕</button>
          </div>

          <!-- Body -->
          <div class="cust-modal-body">
            <div class="cust-product-summary">
              <span class="cust-base-price">${formatCurrency(basePrice)}</span>
              ${product.description ? `<p class="cust-prod-desc">${product.description}</p>` : ''}
            </div>

            <!-- Sección Personalización -->
            <div class="cust-toppings-section">
              <div class="cust-toppings-header">
                <h3>PERSONALIZA TU PEDIDO</h3>
                ${isUniversitario ? `
                  <span class="cust-topping-counter ${atMax ? 'full' : ''}">
                    ${normalToppingsCount} / 4 toppings
                  </span>
                ` : `
                  <span class="cust-topping-counter free">
                    ✨ Toppings ilimitados
                  </span>
                `}
              </div>

              <p class="cust-topping-subtitle">
                ${isUniversitario ? 'Elige hasta 4 toppings sin costo adicional:' : 'Elige los toppings que quieras sin costo adicional:'}
              </p>

              ${isEspecial ? `
                <div class="cust-special-notice">
                  🧀 <b>Incluye lluvia de queso gratinado</b> y porción de papas.
                </div>
              ` : ''}

              <!-- Grilla de Toppings Táctiles -->
              <div class="cust-toppings-grid">
                ${allowedToppings.map(t => {
                  const isCheeseSpecial = isEspecial && cheeseTopping && t.id === cheeseTopping.id;
                  const isSel = selectedToppings.has(t.id);
                  const isDisabled = !isSel && atMax && !isCheeseSpecial;

                  if (isCheeseSpecial) {
                    return `
                      <button type="button" class="cust-topping-chip selected disabled" disabled>
                        <span class="chip-check">✓</span>
                        <span class="chip-name">${t.name} (Incluido)</span>
                      </button>
                    `;
                  }

                  return `
                    <button type="button" class="cust-topping-chip ${isSel ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}"
                            data-topping-id="${t.id}" ${isDisabled ? 'disabled' : ''}>
                      <span class="chip-check">${isSel ? '✓' : '+'}</span>
                      <span class="chip-name">${t.name}</span>
                    </button>
                  `;
                }).join('')}
              </div>

              ${atMax && isUniversitario ? `
                <div class="cust-max-reached-alert">
                  ✋ Alcanzaste el límite de 4 toppings en Menú Universitario. Desmarca uno para cambiarlo.
                </div>
              ` : ''}
            </div>

            <!-- Cantidad -->
            <div class="cust-qty-section">
              <span class="qty-label">Cantidad:</span>
              <div class="qty-controls">
                <button type="button" class="btn-qty" id="btn-qty-minus" ${quantity <= 1 ? 'disabled' : ''}>-</button>
                <span class="qty-value">${quantity}</span>
                <button type="button" class="btn-qty" id="btn-qty-plus">+</button>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="cust-modal-footer">
            <button type="button" class="btn-cust-add-cart" id="btn-confirm-add-cart">
              <span>🛒 AGREGAR AL PEDIDO</span>
              <span class="total-badge">${formatCurrency(currentTotal)}</span>
            </button>
          </div>
        </div>
      `;

      // Bind Modal Events
      modalOverlay.querySelector('#btn-cust-modal-close')?.addEventListener('click', () => {
        modalOverlay.remove();
      });

      modalOverlay.querySelectorAll('.cust-topping-chip:not(.disabled)').forEach((chip) => {
        chip.addEventListener('click', () => {
          const tid = Number(chip.dataset.toppingId);
          if (selectedToppings.has(tid)) {
            selectedToppings.delete(tid);
          } else {
            if (atMax) return;
            selectedToppings.add(tid);
          }
          drawCustomization();
        });
      });

      modalOverlay.querySelector('#btn-qty-minus')?.addEventListener('click', () => {
        if (quantity > 1) {
          quantity--;
          drawCustomization();
        }
      });

      modalOverlay.querySelector('#btn-qty-plus')?.addEventListener('click', () => {
        quantity++;
        drawCustomization();
      });

      modalOverlay.querySelector('#btn-confirm-add-cart')?.addEventListener('click', () => {
        const toppingsDTO = allowedToppings
          .filter((t) => selectedToppings.has(t.id))
          .map((t) => ({
            toppingId: t.id,
            name: t.name,
            toppingName: t.name,
            extraPrice: 0,
            quantity: 1,
          }));

        customerCart.items.push({
          productId: product.id,
          name: product.name,
          quantity,
          menuType,
          unitPrice: basePrice,
          toppings: toppingsDTO,
          _key: crypto.randomUUID(),
        });

        toast.success(`🛒 ${product.name} agregado al pedido`, 2000);
        modalOverlay.remove();
        renderSection();
      });
    }

    drawCustomization();
    document.body.appendChild(modalOverlay);
  }

  // ── Modal de Promos para el Cliente ─────────────────────────────────────────
  async function openCustomerPromoModal(promo) {
    let toppings = [];
    try {
      for (const pid of [1, 2, 3]) {
        const t = await fetchCustomerCatalog(`/api/v1/catalog/products/${pid}/toppings`);
        if (t && t.length > 0) {
          toppings = t.filter(tp => {
            const name = (tp.name || '').toLowerCase();
            return !name.includes('combo universitario') &&
                   !name.includes('queso gratinado') &&
                   !name.includes('lluvia de queso');
          });
          break;
        }
      }
    } catch {
      toppings = [];
    }

    const requiresBev = Boolean(promo.requiresBeverage);
    let beverages = [];
    let selectedBeverageId = null;
    if (requiresBev) {
      try {
        const allBevs = await fetchCustomerCatalog('/api/v1/catalog/beverages');
        beverages = (allBevs || []).filter(b => b.isActive !== false);
      } catch {
        beverages = [];
      }
    }

    const selected = new Set();
    const MAX = promo.maxToppings || 0;
    const overlay = document.createElement('div');
    overlay.className = 'customer-modal-overlay';

    function drawPromo() {
      const count = selected.size;
      const atMax = MAX > 0 && count >= MAX;
      const canConfirm = !requiresBev || Boolean(selectedBeverageId);

      overlay.innerHTML = `
        <div class="customer-modal-card">
          <div class="cust-modal-header">
            <div>
              <span class="cust-modal-tag tag-promo">🔥 PROMOCIÓN</span>
              <h2 class="cust-modal-title">${promo.icon || '🔥'} ${promo.name}</h2>
            </div>
            <button type="button" class="btn-close-modal" id="cpm-close">✕</button>
          </div>
          <div class="cust-modal-body">
            <div class="cust-product-summary">
              <span class="cust-base-price">${formatCurrency(promo.price)}</span>
              <p class="cust-prod-desc">${promo.description || ''}</p>
            </div>

            ${requiresBev ? `
              <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08)">
                <p style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin:0 0 8px 0;">
                  🥤 Selecciona tu bebida (Obligatoria)
                </p>
                <div style="display:flex;flex-direction:column;gap:6px">
                  ${beverages.map(b => {
                    const isSel = selectedBeverageId === b.id;
                    return `
                      <button type="button" class="cust-topping-chip ${isSel ? 'selected' : ''}"
                              data-bev-id="${b.id}" style="justify-content:flex-start">
                        <span>${isSel ? '🔘' : '⚪'} ${b.name}</span>
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}

            ${toppings.length > 0 && MAX > 0 ? `
              <div class="cust-toppings-section">
                <div class="cust-toppings-header">
                  <h3>TOPPINGS INCLUIDOS</h3>
                  <span class="cust-topping-counter ${atMax ? 'full' : ''}">${count} / ${MAX}</span>
                </div>
                <div class="cust-toppings-grid">
                  ${toppings.map(t => {
                    const isSel = selected.has(t.id);
                    const isDisabled = !isSel && atMax;
                    return `
                      <button type="button" class="cust-topping-chip ${isSel ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}"
                              data-topping-id="${t.id}" ${isDisabled ? 'disabled' : ''}>
                        <span class="chip-check">${isSel ? '✓' : '+'}</span>
                        <span class="chip-name">${t.name}</span>
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}
          </div>
          <div class="cust-modal-footer">
            <button type="button" class="btn-cust-add-cart" id="cpm-confirm" ${canConfirm ? '' : 'disabled style="opacity:0.5;cursor:not-allowed;"'}>
              <span>🔥 AGREGAR PROMO</span>
              <span class="total-badge">${formatCurrency(promo.price)}</span>
            </button>
          </div>
        </div>
      `;

      overlay.querySelector('#cpm-close')?.addEventListener('click', () => overlay.remove());

      if (requiresBev) {
        overlay.querySelectorAll('[data-bev-id]').forEach((btn) => {
          btn.addEventListener('click', () => {
            selectedBeverageId = Number(btn.dataset.bevId);
            drawPromo();
          });
        });
      }

      overlay.querySelectorAll('[data-topping-id]:not(.disabled)').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tid = Number(btn.dataset.toppingId);
          if (selected.has(tid)) {
            selected.delete(tid);
          } else {
            if (selected.size >= MAX) return;
            selected.add(tid);
          }
          drawPromo();
        });
      });

      overlay.querySelector('#cpm-confirm')?.addEventListener('click', () => {
        if (requiresBev && !selectedBeverageId) {
          toast.warning('⚠️ Por favor selecciona una bebida para continuar.');
          return;
        }

        const selectedBev = beverages.find((b) => b.id === selectedBeverageId) || null;
        const selToppings = toppings
          .filter((t) => selected.has(t.id))
          .map((t) => ({
            toppingId: t.id,
            name: t.name,
            toppingName: t.name,
            quantity: 1,
            extraPrice: 0,
          }));

        const notesParts = [];
        if (promo.includes && promo.includes.length > 0) {
          notesParts.push(`[Incluye: ${promo.includes.join(', ')}]`);
        }
        if (selectedBev) {
          notesParts.push(`[Bebida: ${selectedBev.name}]`);
        }

        customerCart.items.push({
          productId: promo.productId || 3,
          promoId: promo.id,
          name: promo.name,
          quantity: 1,
          menuType: 'PROMO',
          unitPrice: promo.price,
          toppings: selToppings,
          notes: notesParts.length ? notesParts.join(' ') : undefined,
          _key: crypto.randomUUID(),
          _isPromo: true,
        });

        toast.success(`🔥 Promo ${promo.name} agregada al pedido`, 2000);
        overlay.remove();
        renderSection();
      });
    }

    drawPromo();
    document.body.appendChild(overlay);
  }

  // ── Modal de Carrito del Cliente ───────────────────────────────────────────
  function openCustomerCartModal() {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'customer-modal-overlay';

    function drawCart() {
      const total = calculateCartTotal();
      const count = customerCart.items.reduce((s, i) => s + i.quantity, 0);

      modalOverlay.innerHTML = `
        <div class="customer-modal-card cart-modal-card">
          <div class="cust-modal-header">
            <div>
              <h2 class="cust-modal-title">🛒 Mi Pedido (${count})</h2>
              <span class="cust-modal-sub">Revisa tus productos antes de continuar</span>
            </div>
            <button type="button" class="btn-close-modal" id="btn-cart-close">✕</button>
          </div>

          <div class="cust-modal-body cart-modal-body">
            ${customerCart.items.length === 0 ? `
              <div class="customer-cart-empty">
                <span class="cart-empty-icon">🛒</span>
                <p>Tu pedido está vacío.</p>
                <button type="button" class="btn-back-menu" id="btn-empty-back">Ir al Menú</button>
              </div>
            ` : `
              <div class="customer-cart-items-list">
                ${customerCart.items.map((item, index) => `
                  <div class="customer-cart-item">
                    <div class="cart-item-top">
                      <div class="cart-item-title-group">
                        <span class="cart-item-menu-tag ${item.menuType === 'ESPECIAL' ? 'tag-esp' : 'tag-econ'}">
                          ${item.menuType === 'ESPECIAL' ? '⭐ ESPECIAL' : (item.menuType === 'PROMO' ? '🔥 PROMO' : '🎓 UNIVERSITARIO')}
                        </span>
                        <h4 class="cart-item-name">${item.name}</h4>
                      </div>
                      <button type="button" class="btn-remove-cart-item" data-index="${index}">🗑️</button>
                    </div>

                    ${item.toppings?.length ? `
                      <div class="cart-item-toppings">
                        <small>Toppings: ${item.toppings.map(t => t.name).join(', ')}</small>
                      </div>
                    ` : ''}

                    <div class="cart-item-bottom">
                      <div class="qty-controls-sm">
                        <button type="button" class="btn-qty-sm btn-item-minus" data-index="${index}">-</button>
                        <span class="qty-val-sm">${item.quantity}</span>
                        <button type="button" class="btn-qty-sm btn-item-plus" data-index="${index}">+</button>
                      </div>
                      <span class="cart-item-subtotal">${formatCurrency(item.unitPrice * item.quantity)}</span>
                    </div>
                  </div>
                `).join('')}
              </div>

              <!-- Resumen de Totales -->
              <div class="customer-cart-summary">
                <div class="summary-line">
                  <span>Subtotal</span>
                  <span>${formatCurrency(total)}</span>
                </div>
                <div class="summary-line total-line">
                  <span>TOTAL ESTIMADO</span>
                  <span class="total-value">${formatCurrency(total)}</span>
                </div>
              </div>
            `}
          </div>

          <div class="cust-modal-footer">
            <button type="button" class="btn-secondary-cust" id="btn-cart-continue">
              ← Seguir Pidiendo
            </button>
            ${customerCart.items.length > 0 ? `
              <button type="button" class="btn-primary-cust" id="btn-cart-proceed-notice">
                CONTINUAR ➔
              </button>
            ` : ''}
          </div>
        </div>
      `;

      modalOverlay.querySelector('#btn-cart-close')?.addEventListener('click', () => modalOverlay.remove());
      modalOverlay.querySelector('#btn-cart-continue')?.addEventListener('click', () => modalOverlay.remove());
      modalOverlay.querySelector('#btn-empty-back')?.addEventListener('click', () => modalOverlay.remove());

      modalOverlay.querySelectorAll('.btn-remove-cart-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.index);
          customerCart.items.splice(idx, 1);
          if (customerCart.items.length === 0) {
            modalOverlay.remove();
          } else {
            drawCart();
          }
          if (currentSection) renderSection(); else renderHub();
        });
      });

      modalOverlay.querySelectorAll('.btn-item-minus').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.index);
          if (customerCart.items[idx].quantity > 1) {
            customerCart.items[idx].quantity--;
            drawCart();
            if (currentSection) renderSection(); else renderHub();
          }
        });
      });

      modalOverlay.querySelectorAll('.btn-item-plus').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.index);
          customerCart.items[idx].quantity++;
          drawCart();
          if (currentSection) renderSection(); else renderHub();
        });
      });

      modalOverlay.querySelector('#btn-cart-proceed-notice')?.addEventListener('click', () => {
        toast.info('🎯 Carrito confirmado en la primera fase. ¡El checkout se activará en la siguiente fase!');
      });
    }

    drawCart();
    document.body.appendChild(modalOverlay);
  }

  // Montar vista inicial Hub
  renderHub();
}

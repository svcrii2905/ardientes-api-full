/**
 * cart.js — Panel lateral del carrito / pedido actual
 */
import { store, updateCartItemQty, removeCartItem, clearCart, recalcCart } from '../store/state.js';
import { formatCurrency } from '../utils/currency.js';
import { CONFIG } from '../config.js';
import { customersService } from '../services/customers.service.js';
import { toast } from '../utils/notify.js';

let isMobileCartExpanded = false;
let isOrderTypeDetailsExpanded = false;

export function renderCart(container) {
  function draw() {
    const cart = store.get('cart');
    const hasItems = cart.items.length > 0 || cart.beverages.length > 0 || cart.combos.length > 0;
    const customer = cart.customer;

    // Calcular estado de fidelización si hay cliente
    let loyaltyHtml = '';
    if (customer) {
      const points = customer.loyaltyPoints ?? 0;
      const availableRewards = Math.floor(points / 10);
      const remainder = points % 10;
      const pointsToNext = (remainder === 0 && points > 0) ? 10 : 10 - remainder;

      loyaltyHtml = `
        <div class="cart-customer-card" style="background:var(--bg-card);border:1px solid var(--border-subtle);
                    border-radius:var(--radius-md);padding:var(--space-2) var(--space-3);margin-top:var(--space-2);
                    display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;font-size:var(--text-xs);color:var(--text-primary);">
              👤 ${customer.fullName}
            </span>
            <button class="btn btn-ghost btn-icon-sm" id="btn-remove-customer" title="Quitar cliente" style="padding:0 4px;font-size:10px;">✕</button>
          </div>
          <span style="font-size:11px;color:var(--text-muted);">📞 ${customer.phone}</span>

          <!-- Indicador de Fidelización -->
          <div style="background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.25);border-radius:var(--radius-sm);
                      padding:4px 6px;margin-top:2px;">
            ${availableRewards > 0 ? `
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <span style="font-weight:800;font-size:11px;color:var(--amber-400);">🎉 PREMIO DISPONIBLE</span>
                  <div style="font-size:10px;color:var(--text-secondary);">🍔 ${availableRewards === 1 ? '1 hamburguesa gratis' : `${availableRewards} hamburguesas gratis`} (${points} pts)</div>
                </div>
                <button class="btn btn-primary btn-sm" id="btn-redeem-burger" style="padding:2px 6px;font-size:10px;" title="Canjear 10 puntos">
                  🎁 Canjear
                </button>
              </div>
            ` : `
              <div style="display:flex;flex-direction:column;gap:1px;">
                <span style="font-weight:700;font-size:11px;color:var(--fire-300);">🔥 ${points} / 10 puntos</span>
                <span style="font-size:10px;color:var(--text-muted);">Faltan ${pointsToNext} puntos para una hamburguesa gratis</span>
              </div>
            `}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <aside class="cart-panel ${!isMobileCartExpanded ? 'cart-collapsed' : ''}">
        <!-- Acceso compacto al pedido en móvil -->
        <div class="cart-mobile-summary" style="display:none;" id="btn-mobile-expand-area">
          <div class="mobile-summary-bar">
            <div class="mobile-summary-trigger" id="btn-mobile-expand-trigger">
              <span class="mobile-cart-badge">
                🧾 PEDIDO ${(cart.items.length + cart.beverages.length + cart.combos.length) > 0 
                  ? `<span class="cart-count-pill">${cart.items.length + cart.beverages.length + cart.combos.length}</span>` 
                  : ''}
              </span>
              <span class="mobile-cart-total">${formatCurrency(cart.total)}</span>
            </div>
            <div class="mobile-summary-btns">
              <button class="btn btn-secondary btn-sm" id="btn-mobile-expand" style="padding:4px 10px; font-size:11px; font-weight:bold;">
                ${isMobileCartExpanded ? '↓ Ocultar' : 'Ver pedido ↑'}
              </button>
              ${hasItems ? `
                <button class="btn btn-primary btn-sm" id="btn-mobile-send-and-pay" style="padding:4px 10px; font-size:11px; font-weight:bold;">
                  💳 COBRAR
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Cabecera del carrito -->
        <div class="cart-header">
          <div class="cart-header-top">
            <span class="cart-title">🧾 Pedido actual</span>
            <div style="display:flex; gap:8px;">
              ${hasItems ? `<button class="btn btn-ghost btn-sm" id="btn-clear-cart" title="Limpiar pedido">🗑️</button>` : ''}
              <button class="btn btn-ghost btn-sm btn-mobile-collapse" id="btn-mobile-collapse" style="display:none; font-weight:bold; font-size:12px;">↓ Volver al menú</button>
            </div>
          </div>

          <!-- Barra compacta desplegable de Tipo de Pedido (Móvil) -->
          <div class="order-type-summary-bar" id="btn-toggle-order-type-details">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-weight:800; font-size:12px; color:var(--text-primary);">
                ${cart.orderType === 'MESA' ? `🪑 MESA ${cart.tableId || '?'}` : (cart.orderType === 'DOMICILIO' ? '🛵 DOMICILIO' : '📦 RECOGER')}
              </span>
              ${customer ? `<span style="font-size:11px; color:var(--amber-400); font-weight:bold;">· 👤 ${customer.fullName}</span>` : ''}
            </div>
            <span style="font-size:11px; color:var(--text-muted); font-weight:bold;">
              ${isOrderTypeDetailsExpanded ? 'Configurar ▲' : 'Configurar ▼'}
            </span>
          </div>

          <!-- Detalle desplegable de Tipo de Pedido -->
          <div class="order-type-details-container ${!isOrderTypeDetailsExpanded ? 'collapsed-mobile' : ''}">
            <!-- Tipo de pedido -->
            <div class="order-type-group" id="order-type-group">
              ${CONFIG.ORDER_TYPES.map(t => `
                <button class="order-type-btn${cart.orderType === t.value ? ' active' : ''}"
                        data-type="${t.value}">
                  ${t.icon} ${t.label}
                </button>
              `).join('')}
            </div>

            <!-- Identificación de Cliente -->
            ${!customer ? `
              <div class="input-group" style="margin-top:var(--space-1);display:flex;gap:4px;">
                <input class="input input-sm" id="input-search-phone" type="tel"
                       placeholder="📞 Teléfono del cliente..." style="flex:1;font-size:var(--text-xs);" />
                <button class="btn btn-secondary btn-sm" id="btn-find-phone" title="Identificar cliente" style="padding:0 8px;">
                  🔍
                </button>
              </div>
            ` : loyaltyHtml}

            <!-- Campo de mesa (solo si orderType === MESA) -->
            ${cart.orderType === 'MESA' ? `
              <div class="input-group" style="margin-top:var(--space-1)">
                <select class="input input-sm" id="input-table">
                  <option value="">-- Seleccionar Mesa (1 a 7) --</option>
                  ${[1, 2, 3, 4, 5, 6, 7].map(num => `
                    <option value="${num}" ${Number(cart.tableId) === num ? 'selected' : ''}>
                      MESA ${num}
                    </option>
                  `).join('')}
                </select>
              </div>` : ''}

            <!-- Campo de dirección (solo si orderType === DOMICILIO) -->
            ${cart.orderType === 'DOMICILIO' ? `
              <div class="input-group" style="margin-top:var(--space-1)">
                <input class="input input-sm" id="input-delivery-address"
                       placeholder="🛵 Dirección de entrega" autocomplete="street-address"
                       value="${cart.deliveryAddress || (customer?.address || '')}" />
              </div>` : ''}
          </div>
        </div>

        <!-- Lista de ítems -->
        <div class="cart-items" id="cart-items-list">
          ${hasItems ? renderCartItems(cart) : `
            <div class="cart-empty">
              <div class="cart-empty-icon">🛒</div>
              <p>Agrega productos del menú para comenzar el pedido</p>
            </div>
          `}
        </div>

        <!-- Totales y botón de cobro -->
        <div class="cart-footer">
          <div class="cart-summary-row">
            <span class="cart-summary-label">Subtotal</span>
            <span class="cart-summary-value">${formatCurrency(cart.subtotal)}</span>
          </div>
          ${cart.disposableFee > 0 ? `
          <div class="cart-summary-row" style="color:var(--amber-400)">
            <span class="cart-summary-label">📦 Desechables (${cart.orderType === 'DOMICILIO' ? 'Domicilio' : 'Para llevar'})</span>
            <span class="cart-summary-value">+${formatCurrency(cart.disposableFee)}</span>
          </div>` : ''}
          ${cart.discountAmount > 0 ? `
          <div class="cart-summary-row">
            <span class="cart-summary-label">Descuento</span>
            <span class="cart-summary-value" style="color:var(--status-online)">-${formatCurrency(cart.discountAmount)}</span>
          </div>` : ''}
          <div class="cart-summary-row">
            <span class="cart-summary-label">Impoconsumo (8%)</span>
            <span class="cart-summary-value">${formatCurrency(cart.taxAmount)}</span>
          </div>

          <div class="cart-total-row">
            <span class="cart-total-label">TOTAL</span>
            <span class="cart-total-value">${formatCurrency(cart.total)}</span>
          </div>

          <div class="cart-actions" style="display: flex; gap: 8px;">
            <button class="btn-checkout" id="btn-send-only" ${!hasItems ? 'disabled' : ''} style="flex: 1; background: var(--surface-100); color: var(--text-primary); font-size: 0.9rem;">
              COCINA
            </button>
            <button class="btn-checkout" id="btn-send-and-pay" ${!hasItems ? 'disabled' : ''} style="flex: 2;">
              💳 COBRAR
            </button>
          </div>

          <!-- Campo de notas -->
          ${hasItems ? `
          <input class="input" id="input-notes" placeholder="Notas del pedido (opcional)"
                 value="${cart.notes || ''}" style="font-size:var(--text-sm)" />
          ` : ''}
        </div>
      </aside>
    `;

    bindCartEvents(container);
  }

  function renderCartItems(cart) {
    let html = '';
    for (const item of cart.items) {
      // Excluir el topping técnico de combo de las adiciones impresas
      const filteredToppings = (item.toppings ?? []).filter(t => {
        const name = (t.toppingName || t.name || '').toLowerCase();
        return !name.includes('combo universitario');
      });
      const toppingStr = filteredToppings.length
        ? filteredToppings.map(t => `+ ${t.toppingName || t.name}`).join(', ')
        : '';
      
      const isCombo = item.notes === "En Combo (+ Papitas + Gaseosa)";
      const isUniversitario = item.menuType === 'UNIVERSITARIO';
      const extraToppingsCount = isUniversitario ? Math.max(0, filteredToppings.length - 4) : 0;
      const extraToppingsSurcharge = extraToppingsCount * 1000;

      html += `
        <div class="cart-item" data-key="${item._key}">
          <div class="cart-item-top">
            <span class="cart-item-name">${item.name}</span>
            <span class="cart-item-total">${formatCurrency(item.lineTotal)}</span>
          </div>
          
          <!-- Detalles del Combo Universitario -->
          ${isCombo ? `
            <div class="cart-item-combo-details" style="margin:2px 0 4px var(--space-2);
                        display:flex;flex-direction:column;gap:2px;font-size:var(--text-xs);">
              <span style="font-weight:700;color:var(--status-online)">✓ En Combo</span>
              <span style="color:var(--text-secondary)">+ Papitas</span>
              <span style="color:var(--text-secondary)">+ Gaseosa</span>
              <span style="color:var(--amber-400);font-size:10px">Adicional combo: ${formatCurrency(5000)}</span>
            </div>
          ` : ''}

          ${toppingStr ? `<div class="cart-item-toppings" style="color:var(--fire-300)">${toppingStr}</div>` : ''}
          ${extraToppingsCount > 0 ? `<div style="font-size:10px;color:var(--amber-400);margin-top:2px">Adicional toppings (+${extraToppingsCount}): +${formatCurrency(extraToppingsSurcharge * item.qty)}</div>` : ''}
          
          <div class="cart-item-controls">
            <div class="cart-item-qty">
              <button class="qty-btn" data-action="dec" data-key="${item._key}">−</button>
              <span class="qty-display">${item.qty}</span>
              <button class="qty-btn" data-action="inc" data-key="${item._key}">+</button>
            </div>
            <span style="font-size:var(--text-xs);color:var(--text-muted)">
              ${formatCurrency(item.unitPrice)} c/u
              ${item.menuType !== 'AMBOS' ? `· ${item.menuType}` : ''}
            </span>
            <button class="btn btn-ghost btn-icon-sm" data-action="remove" data-key="${item._key}"
                    style="margin-left:auto" title="Eliminar">✕</button>
          </div>
        </div>
      `;
    }
    return html;
  }

  function bindCartEvents(container) {
    // Toggle desplegable de configuración de tipo de pedido en móvil
    container.querySelector('#btn-toggle-order-type-details')?.addEventListener('click', (e) => {
      e.stopPropagation();
      isOrderTypeDetailsExpanded = !isOrderTypeDetailsExpanded;
      draw();
    });

    // Cambiar tipo de pedido
    container.querySelector('#order-type-group')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.order-type-btn');
      if (!btn) return;
      store.set({ cart: { ...store.get('cart'), orderType: btn.dataset.type, tableId: null } });
      recalcCart(); // Recalcula desechables ($0 si MESA, $1.000 si RECOGER/DOMICILIO)
    });

    // Buscar cliente por teléfono
    const searchPhoneAction = async () => {
      const input = container.querySelector('#input-search-phone');
      const phone = input?.value?.trim();
      if (!phone) {
        toast.warning('Ingresa el teléfono del cliente');
        return;
      }
      try {
        const customer = await customersService.getByPhone(phone);
        store.set({
          cart: {
            ...store.get('cart'),
            customerId: customer.id,
            customer,
            deliveryAddress: customer.address || store.get('cart').deliveryAddress,
          },
        });
        toast.success(`Cliente identificado: ${customer.fullName}`);
      } catch {
        toast.error(`No se encontró cliente con el teléfono ${phone}`);
      }
    };

    container.querySelector('#btn-find-phone')?.addEventListener('click', searchPhoneAction);
    container.querySelector('#input-search-phone')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchPhoneAction();
    });

    // Quitar cliente asignado
    container.querySelector('#btn-remove-customer')?.addEventListener('click', () => {
      store.set({
        cart: {
          ...store.get('cart'),
          customerId: null,
          customer: null,
        },
      });
      toast.info('Cliente desvinculado del pedido');
    });

    // Canjear recompensa de fidelización
    container.querySelector('#btn-redeem-burger')?.addEventListener('click', async () => {
      const c = store.get('cart').customer;
      if (!c) return;
      const user = store.get('currentUser');
      if (!confirm(`¿Deseas canjear 10 puntos de ${c.fullName} por 1 hamburguesa gratis?`)) return;

      try {
        const res = await customersService.redeem(c.id, 1, user.id, 'Canje en caja');
        toast.success(res.message || '🎉 ¡Hamburguesa gratis canjeada!');
        // Actualizar datos del cliente en el store
        const updatedCustomer = await customersService.getById(c.id);
        store.set({
          cart: {
            ...store.get('cart'),
            customer: updatedCustomer,
          },
        });
      } catch (err) {
        toast.error(`Error al redimir: ${err.message}`);
      }
    });

    // Número de mesa
    container.querySelector('#input-table')?.addEventListener('change', (e) => {
      store.set({ cart: { ...store.get('cart'), tableId: Number(e.target.value) || null } });
    });

    // Dirección de domicilio
    container.querySelector('#input-delivery-address')?.addEventListener('change', (e) => {
      store.set({ cart: { ...store.get('cart'), deliveryAddress: e.target.value } });
    });

    // Notas
    container.querySelector('#input-notes')?.addEventListener('change', (e) => {
      store.set({ cart: { ...store.get('cart'), notes: e.target.value } });
    });

    // Limpiar carrito
    container.querySelector('#btn-clear-cart')?.addEventListener('click', () => {
      if (confirm('¿Deseas limpiar el pedido actual?')) clearCart();
    });

    // Expandir/Colapsar móvil
    container.querySelector('#btn-mobile-expand')?.addEventListener('click', (e) => {
      e.stopPropagation();
      isMobileCartExpanded = !isMobileCartExpanded;
      draw();
    });
    container.querySelector('#btn-mobile-expand-trigger')?.addEventListener('click', (e) => {
      e.stopPropagation();
      isMobileCartExpanded = !isMobileCartExpanded;
      draw();
    });
    container.querySelector('#btn-mobile-collapse')?.addEventListener('click', (e) => {
      e.stopPropagation();
      isMobileCartExpanded = false;
      draw();
    });

    // Validaciones de carrito antes de enviar
    function validateCart(currentCart) {
      if (currentCart.orderType === 'MESA' && !currentCart.tableId) {
        const input = container.querySelector('#input-table');
        if (input) {
          input.focus();
          input.style.borderColor = 'var(--fire-500)';
          setTimeout(() => { input.style.borderColor = ''; }, 2000);
        }
        alert('⚠️ Ingresa el número de mesa.');
        return false;
      }
      if (currentCart.orderType === 'DOMICILIO' && !currentCart.deliveryAddress?.trim()) {
        const input = container.querySelector('#input-delivery-address');
        if (input) {
          input.focus();
          input.style.borderColor = 'var(--fire-500)';
          setTimeout(() => { input.style.borderColor = ''; }, 2000);
        }
        alert('⚠️ Ingresa la dirección de entrega.');
        return false;
      }
      return true;
    }

    // Botón Solo Confirmar (Enviar a cocina)
    const handleSendOnly = (e) => {
      e?.stopPropagation();
      const currentCart = store.get('cart');
      if (!validateCart(currentCart)) {
        if (!isMobileCartExpanded) {
          isMobileCartExpanded = true;
          draw();
        }
        return;
      }
      container.dispatchEvent(new CustomEvent('pos:sendOnly', { bubbles: true }));
    };

    // Botón Confirmar y Cobrar
    const handleSendAndPay = (e) => {
      e?.stopPropagation();
      const currentCart = store.get('cart');
      if (!validateCart(currentCart)) {
        if (!isMobileCartExpanded) {
          isMobileCartExpanded = true;
          draw();
        }
        return;
      }
      container.dispatchEvent(new CustomEvent('pos:sendAndPay', { bubbles: true }));
    };

    container.querySelector('#btn-send-only')?.addEventListener('click', handleSendOnly);
    container.querySelector('#btn-mobile-send-only')?.addEventListener('click', handleSendOnly);

    container.querySelector('#btn-send-and-pay')?.addEventListener('click', handleSendAndPay);
    container.querySelector('#btn-mobile-send-and-pay')?.addEventListener('click', handleSendAndPay);

    // Controles de cantidad e ítem
    container.querySelector('#cart-items-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const key = btn.dataset.key;
      const action = btn.dataset.action;
      if (action === 'inc')    updateCartItemQty(key, +1);
      if (action === 'dec')    updateCartItemQty(key, -1);
      if (action === 'remove') removeCartItem(key);
    });
  }

  // Suscribirse al store para redibujar cuando cambie el carrito
  store.subscribe('cart', draw);
  draw();
}

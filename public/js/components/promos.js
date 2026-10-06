/**
 * promos.js — Sección 🔥 PROMOCIONES de Ardientes POS
 *
 * Las promociones son configuraciones de precio fijo que envuelven
 * productos existentes. Se representan como ítems especiales de carrito
 * con: precio promocional, toppings incluidos (sin costo extra), y
 * bebidas/papas incluidas indicadas en las notas del ítem.
 *
 * Se integran en el grid de productos del POS y del Mesero mediante
 * una pestaña "🔥 PROMOS" en las categorías.
 *
 * FLUJO BEBIDA:
 *   Las promos con requiresBeverage = true muestran un selector obligatorio
 *   de bebida. La bebida seleccionada viaja en _promoBeverage del item de
 *   carrito y pos.js la incluye en order.beverages con unitPrice = 0
 *   (incluida en el precio de la promo), sin afectar el precio del catálogo.
 */
import { store, recalcCart } from '../store/state.js';
import { formatCurrency } from '../utils/currency.js';
import { toast } from '../utils/notify.js';
import { catalogService } from '../services/catalog.service.js';

// ─── Definición de Promociones ────────────────────────────────────────────────
export const PROMOTIONS = [
  {
    id: 'promo-1',
    name: 'Doble Carne',
    productId: 3,
    price: 10000,
    description: 'Hamburguesa doble carne — Incluye 4 toppings',
    icon: '🍔',
    maxToppings: 4,
    hasToppings: true,
    includes: [],
    specialFlow: null,
    requiresBeverage: false,
  },
  {
    id: 'promo-2',
    name: 'Salchipapa Promo',
    productId: 13,
    price: 15000,
    description: 'Salchipapa + Gaseosa — Incluye 4 toppings',
    icon: '🍟',
    maxToppings: 4,
    hasToppings: true,
    includes: ['Gaseosa incluida'],
    specialFlow: null,
    requiresBeverage: true,
  },
  {
    id: 'promo-3',
    name: 'Mazorcada Promo',
    productId: 17,
    price: 15000,
    description: 'Mazorcada + Gaseosa — Incluye 4 toppings',
    icon: '🌽',
    maxToppings: 4,
    hasToppings: true,
    includes: ['Gaseosa incluida'],
    specialFlow: null,
    requiresBeverage: true,
  },
  {
    id: 'promo-4',
    name: 'Promo 6 Mini Hamburguesas',
    productId: 30,
    price: 26000,
    discountAmount: 14000,
    description: '6 mini hamburguesas — 3 toppings para el primer grupo + 3 toppings para el segundo',
    icon: '🍱',
    maxToppings: 3,
    hasToppings: true,
    includes: [],
    specialFlow: 'mini6',
    requiresBeverage: false,
  },
  {
    id: 'promo-5',
    name: 'Doble Carne en Combo',
    productId: 3,
    price: 15000,
    description: 'Hamburguesa doble carne + Papas + Gaseosa — Incluye 4 toppings',
    icon: '🔥',
    maxToppings: 4,
    hasToppings: true,
    includes: ['Papas incluidas', 'Gaseosa incluida'],
    specialFlow: null,
    requiresBeverage: true,
  },
  {
    id: 'promo-6',
    name: 'Combo 3 Tentadoras + Papas',
    productId: 2,
    price: 30000,
    description: '3 hamburguesas Tentadoras + 1 porción de papas — 4 toppings por hamburguesa',
    icon: '🎯',
    maxToppings: 4,
    hasToppings: true,
    includes: ['Porción de papas incluida'],
    specialFlow: 'tentadoras3',
    requiresBeverage: false,
  },
  {
    id: 'promo-7',
    name: 'Combo Doble Carne + Salchipapa + Gaseosa',
    productId: 3,
    price: 30000,
    description: 'Hamburguesa doble carne + Salchipapa + Gaseosa — Incluye 4 toppings para la hamburguesa',
    icon: '💥',
    maxToppings: 4,
    hasToppings: true,
    includes: ['Salchipapa incluida', 'Gaseosa incluida'],
    specialFlow: null,
    requiresBeverage: true,
  },
  {
    id: 'promo-8',
    name: 'Promo Dorilocos',
    productId: 27,
    price: 15000,
    description: 'Dorilocos — Incluye 4 toppings',
    icon: '🌶️',
    maxToppings: 4,
    hasToppings: true,
    includes: [],
    specialFlow: null,
    requiresBeverage: false,
  },
];

// ─── Carga de Toppings ────────────────────────────────────────────────────────
let cachedToppings = null;

async function getAvailableToppings() {
  if (cachedToppings) return cachedToppings;
  try {
    for (const pid of [1, 2, 3]) {
      const toppings = await catalogService.getProductToppings(pid);
      if (toppings && toppings.length > 0) {
        cachedToppings = toppings.filter(t => {
          const name = (t.name || '').toLowerCase();
          return !name.includes('combo universitario') &&
                 !name.includes('queso gratinado') &&
                 !name.includes('lluvia de queso');
        });
        return cachedToppings;
      }
    }
    return [];
  } catch {
    return [];
  }
}

// ─── Carga de Bebidas ─────────────────────────────────────────────────────────
let cachedBeverages = null;

async function getAvailableBeverages() {
  return [
    { id: 1, name: 'Gaseosa 250 ml retornable', price: 0 },
    { id: 2, name: 'Gaseosa 250 ml no retornable', price: 0 }
  ];
}

// ─── Agregar Promo al Carrito ─────────────────────────────────────────────────
function addPromoToCart(promo, selectedToppings = [], notes = '', selectedBeverage = null) {
  const cart = store.get('cart');

  const toppingItems = selectedToppings.map(t => ({
    toppingId: t.id,
    toppingName: t.name,
    extraPrice: 0,
    quantity: 1,
  }));

  const includesNote = promo.includes.length > 0
    ? `[Incluye: ${promo.includes.join(', ')}]`
    : '';
  const fullNotes = [notes, includesNote].filter(Boolean).join(' ');

  const newItem = {
    productId: promo.productId,
    promoId: promo.id,
    name: promo.name,
    qty: 1,
    unitPrice: promo.price,
    menuType: 'UNIVERSITARIO',
    toppings: toppingItems,
    notes: fullNotes || undefined,
    lineTotal: promo.price,
    promoDiscount: promo.discountAmount || 0,
    _key: crypto.randomUUID(),
    _isPromo: true,
    _promoBeverage: selectedBeverage
      ? { beverageId: selectedBeverage.id, beverageName: selectedBeverage.name }
      : null,
  };

  const items = [...cart.items, newItem];
  const newDiscount = (cart.discountAmount || 0) + (promo.discountAmount || 0);
  store.set({ cart: { ...cart, items, discountAmount: newDiscount } });
  recalcCart();

  const beverageLabel = selectedBeverage ? ` + ${selectedBeverage.name}` : '';
  toast.success(`${promo.icon} ${promo.name}${beverageLabel} agregada al pedido`, 2000);
}

// ─── Modal de Personalización de Promo ───────────────────────────────────────
export async function openPromoModal(promo) {
  const toppings = await getAvailableToppings();

  if (promo.specialFlow === 'mini6') {
    openMini6Modal(promo, toppings);
    return;
  }
  if (promo.specialFlow === 'tentadoras3') {
    openTentadoras3Modal(promo, toppings);
    return;
  }

  let beverages = promo.requiresBeverage ? await getAvailableBeverages() : [];

  if (promo.id === 'promo-2') {
    const allBevs = await catalogService.getBeverages();
    const activeBevs = (allBevs || []).filter(b => b.isActive !== false);
    const orderType = store.get('cart').orderType;
    
    if (orderType === 'MESA') {
      beverages = activeBevs.filter(b => {
        const n = b.name.toLowerCase();
        return (n.includes('coca') || n.includes('postob')) && n.includes('250');
      });
    } else {
      beverages = activeBevs.filter(b => {
        const n = b.name.toLowerCase();
        return n.includes('tropicola') && (n.includes('manzana') || n.includes('colombiana'));
      });
    }
  }

  openStandardPromoModal(promo, toppings, beverages);
}

// ─── Modal Estándar ───────────────────────────────────────────────────────────
function openStandardPromoModal(promo, toppings, beverages) {
  const selected = new Set();
  let selectedBeverageId = null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'promo-modal-overlay';

  const requiresBev = promo.requiresBeverage && beverages.length > 0;

  overlay.innerHTML = `
    <div class="modal promo-modal" style="max-width:540px;">
      <div class="modal-header">
        <div>
          <h2 class="modal-title">${promo.icon} ${promo.name}</h2>
          <p style="font-size:var(--text-xs);color:var(--text-muted);margin-top:2px">${promo.description}</p>
        </div>
        <button class="btn btn-ghost btn-icon" id="pm-close">✕</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:var(--space-4)">

        <div class="promo-price-banner">
          <span class="promo-badge">🔥 PROMOCIÓN</span>
          <span class="promo-price-display">${formatCurrency(promo.price)}</span>
        </div>

        ${promo.includes.length > 0 ? `
          <div class="promo-includes-bar">
            ${promo.includes.map(inc => `<span class="promo-include-chip">✅ ${inc}</span>`).join('')}
          </div>
        ` : ''}

        ${requiresBev ? `
          <div class="promo-beverage-section" style="background:rgba(255,255,255,0.03);padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08)">
            <p style="font-size:var(--text-xs);font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:6px">
              <span>🥤</span> Selecciona tu gaseosa (Obligatoria)
            </p>
            <div class="promo-beverage-grid" id="promo-bev-grid" style="display:flex;flex-direction:column;gap:6px">
              ${beverages.map(b => `
                <button type="button" class="promo-bev-btn" data-bev-id="${b.id}" id="promo-bev-btn-${b.id}"
                        style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:#E2E8F0;font-size:0.85rem;font-weight:500;cursor:pointer;transition:all 0.15s ease;text-align:left;width:100%;">
                  <span class="bev-radio-icon" style="font-size:1.1rem;line-height:1">⚪</span>
                  <span style="flex:1">${b.name}</span>
                </button>
              `).join('')}
            </div>
            <p id="promo-bev-status" style="font-size:var(--text-xs);color:#F87171;margin-top:8px;display:flex;align-items:center;gap:4px">
              ⚠️ Debes seleccionar una gaseosa para continuar
            </p>
          </div>
        ` : ''}

        ${promo.hasToppings && toppings.length > 0 ? `
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
              <p style="font-size:var(--text-xs);font-weight:700;color:var(--text-secondary);text-transform:uppercase">
                Selecciona toppings (Gratis — incluidos en la promo)
              </p>
              <span class="promo-topping-counter" id="pm-topping-counter">
                0 / ${promo.maxToppings}
              </span>
            </div>
            <div class="toppings-selection-grid" id="toppings-grid">
              ${toppings.map(t => `
                <button type="button" class="topping-chip-btn" data-id="${t.id}" id="topping-btn-${t.id}">
                  <span class="tc-name">${t.name}</span>
                  <span class="tc-price">Incluido</span>
                </button>
              `).join('')}
            </div>
          </div>
        ` : promo.hasToppings ? `
          <p style="color:var(--text-muted);font-size:var(--text-sm)">No hay toppings disponibles actualmente.</p>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="pm-cancel">Cancelar</button>
        <button class="btn btn-primary btn-lg" id="pm-confirm" style="flex:1" ${requiresBev ? 'disabled' : ''}>
          🔥 Agregar promo — ${formatCurrency(promo.price)}
        </button>
      </div>
    </div>
  `;

  function updateUI() {
    const count = selected.size;
    const atMax = count >= promo.maxToppings;
    const selectedBev = beverages.find(b => b.id === selectedBeverageId) ?? null;
    const canConfirm = !requiresBev || selectedBev !== null;

    const counterEl = overlay.querySelector('#pm-topping-counter');
    if (counterEl) {
      counterEl.textContent = `${count} / ${promo.maxToppings}`;
      if (atMax) counterEl.classList.add('counter-full');
      else counterEl.classList.remove('counter-full');
    }

    toppings.forEach(t => {
      const btn = overlay.querySelector(`#topping-btn-${t.id}`);
      if (!btn) return;
      const isSel = selected.has(t.id);
      const isDisabled = !isSel && atMax;

      btn.classList.toggle('selected', isSel);
      btn.classList.toggle('disabled', isDisabled);
      btn.disabled = isDisabled;
    });

    if (requiresBev) {
      beverages.forEach(b => {
        const btn = overlay.querySelector(`#promo-bev-btn-${b.id}`);
        if (!btn) return;
        const isSel = b.id === selectedBeverageId;
        const iconEl = btn.querySelector('.bev-radio-icon');

        btn.classList.toggle('selected', isSel);
        btn.style.borderColor = isSel ? '#FF5500' : 'rgba(255,255,255,0.12)';
        btn.style.background = isSel ? 'rgba(255,85,0,0.18)' : 'rgba(255,255,255,0.04)';
        btn.style.color = isSel ? '#FF8844' : '#E2E8F0';
        btn.style.fontWeight = isSel ? '700' : '500';
        if (iconEl) iconEl.textContent = isSel ? '🔘' : '⚪';
      });

      const statusEl = overlay.querySelector('#promo-bev-status');
      if (statusEl) {
        if (!selectedBev) {
          statusEl.style.color = '#F87171';
          statusEl.innerHTML = `⚠️ Debes seleccionar una gaseosa para continuar`;
        } else {
          statusEl.style.color = '#34D399';
          statusEl.innerHTML = `✅ Seleccionaste: <strong>${selectedBev.name}</strong>`;
        }
      }
    }

    const confirmBtn = overlay.querySelector('#pm-confirm');
    if (confirmBtn) {
      confirmBtn.disabled = !canConfirm;
    }
  }

  overlay.querySelector('#pm-close').onclick = () => overlay.remove();
  overlay.querySelector('#pm-cancel').onclick = () => overlay.remove();

  if (requiresBev) {
    beverages.forEach(b => {
      const btn = overlay.querySelector(`#promo-bev-btn-${b.id}`);
      if (btn) {
        btn.onclick = () => {
          selectedBeverageId = b.id;
          updateUI();
        };
      }
    });
  }

  toppings.forEach(t => {
    const btn = overlay.querySelector(`#topping-btn-${t.id}`);
    if (btn) {
      btn.onclick = () => {
        if (selected.has(t.id)) {
          selected.delete(t.id);
        } else {
          if (selected.size >= promo.maxToppings) {
            toast.warning(`Esta promo incluye hasta ${promo.maxToppings} toppings.`);
            return;
          }
          selected.add(t.id);
        }
        updateUI();
      };
    }
  });

  overlay.querySelector('#pm-confirm').onclick = () => {
    const selectedBev = beverages.find(b => b.id === selectedBeverageId) ?? null;
    if (requiresBev && !selectedBev) {
      toast.warning('⚠️ Debes seleccionar una gaseosa para continuar.');
      return;
    }
    const selToppings = toppings.filter(t => selected.has(t.id));
    addPromoToCart(promo, selToppings, '', selectedBev);
    overlay.remove();
  };

  document.body.appendChild(overlay);
  updateUI();
}

// ─── Modal 6 Mini Hamburguesas (3+3) ─────────────────────────────────────────
function openMini6Modal(promo, toppings) {
  const group1 = new Set();
  const group2 = new Set();
  const MAX_PER_GROUP = 3;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  function draw() {
    overlay.innerHTML = `
      <div class="modal promo-modal" style="max-width:620px;">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">${promo.icon} ${promo.name}</h2>
            <p style="font-size:var(--text-xs);color:var(--text-muted);margin-top:2px">${promo.description}</p>
          </div>
          <button class="btn btn-ghost btn-icon" id="pm-close">✕</button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:var(--space-5)">
          <div class="promo-price-banner">
            <span class="promo-badge">🔥 PROMOCIÓN</span>
            <span class="promo-price-display">${formatCurrency(promo.price)}</span>
          </div>

          <div class="promo-mini-group">
            <div class="promo-mini-group-header">
              <span class="promo-mini-group-title">🍔🍔🍔 Grupo A — 3 Mini Hamburguesas</span>
              <span class="promo-topping-counter ${group1.size >= MAX_PER_GROUP ? 'counter-full' : ''}">${group1.size} / ${MAX_PER_GROUP} toppings</span>
            </div>
            <div class="toppings-selection-grid">
              ${toppings.map(t => {
                const isSel = group1.has(t.id);
                const isDisabled = !isSel && group1.size >= MAX_PER_GROUP;
                return `<button class="topping-chip-btn${isSel ? ' selected' : ''}${isDisabled ? ' disabled' : ''}"
                                data-group="1" data-id="${t.id}" ${isDisabled ? 'disabled' : ''}>
                          <span class="tc-name">${t.name}</span>
                          <span class="tc-price">Incluido</span>
                        </button>`;
              }).join('')}
            </div>
          </div>

          <div class="promo-mini-group">
            <div class="promo-mini-group-header">
              <span class="promo-mini-group-title">🍔🍔🍔 Grupo B — 3 Mini Hamburguesas</span>
              <span class="promo-topping-counter ${group2.size >= MAX_PER_GROUP ? 'counter-full' : ''}">${group2.size} / ${MAX_PER_GROUP} toppings</span>
            </div>
            <div class="toppings-selection-grid">
              ${toppings.map(t => {
                const isSel = group2.has(t.id);
                const isDisabled = !isSel && group2.size >= MAX_PER_GROUP;
                return `<button class="topping-chip-btn${isSel ? ' selected' : ''}${isDisabled ? ' disabled' : ''}"
                                data-group="2" data-id="${t.id}" ${isDisabled ? 'disabled' : ''}>
                          <span class="tc-name">${t.name}</span>
                          <span class="tc-price">Incluido</span>
                        </button>`;
              }).join('')}
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="pm-cancel">Cancelar</button>
          <button class="btn btn-primary btn-lg" id="pm-confirm" style="flex:1">
            🔥 Agregar promo — ${formatCurrency(promo.price)}
          </button>
        </div>
      </div>
    `;

    overlay.querySelector('#pm-close').onclick = () => overlay.remove();
    overlay.querySelector('#pm-cancel').onclick = () => overlay.remove();

    overlay.querySelectorAll('.topping-chip-btn').forEach(btn => {
      btn.onclick = () => {
        const group = btn.dataset.group === '1' ? group1 : group2;
        const id = Number(btn.dataset.id);
        if (group.has(id)) {
          group.delete(id);
        } else {
          if (group.size >= MAX_PER_GROUP) {
            toast.warning(`Cada grupo admite hasta ${MAX_PER_GROUP} toppings.`);
            return;
          }
          group.add(id);
        }
        draw();
      };
    });

    overlay.querySelector('#pm-confirm').onclick = () => {
      const g1Toppings = toppings.filter(t => group1.has(t.id));
      const g2Toppings = toppings.filter(t => group2.has(t.id));
      const allToppings = [...g1Toppings, ...g2Toppings];
      const notes = `Grupo A: [${g1Toppings.map(t => t.name).join(', ') || 'Sin toppings'}] · Grupo B: [${g2Toppings.map(t => t.name).join(', ') || 'Sin toppings'}]`;
      addPromoToCart(promo, allToppings, notes, null);
      overlay.remove();
    };
  }

  draw();
  document.body.appendChild(overlay);
}

// ─── Modal 3 Tentadoras (4 toppings por hamburguesa) ─────────────────────────
function openTentadoras3Modal(promo, toppings) {
  const selections = [new Set(), new Set(), new Set()];
  const MAX_PER_BURGER = 4;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  function draw() {
    overlay.innerHTML = `
      <div class="modal promo-modal" style="max-width:620px;max-height:92dvh;">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">${promo.icon} ${promo.name}</h2>
            <p style="font-size:var(--text-xs);color:var(--text-muted);margin-top:2px">${promo.description}</p>
          </div>
          <button class="btn btn-ghost btn-icon" id="pm-close">✕</button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:var(--space-4);overflow-y:auto">
          <div class="promo-price-banner">
            <span class="promo-badge">🔥 PROMOCIÓN</span>
            <span class="promo-price-display">${formatCurrency(promo.price)}</span>
          </div>
          <div class="promo-includes-bar">
            <span class="promo-include-chip">✅ Porción de papas incluida</span>
          </div>

          ${[0, 1, 2].map(idx => `
            <div class="promo-mini-group">
              <div class="promo-mini-group-header">
                <span class="promo-mini-group-title">🍔 Tentadora ${idx + 1}</span>
                <span class="promo-topping-counter ${selections[idx].size >= MAX_PER_BURGER ? 'counter-full' : ''}">${selections[idx].size} / ${MAX_PER_BURGER} toppings</span>
              </div>
              <div class="toppings-selection-grid">
                ${toppings.map(t => {
                  const isSel = selections[idx].has(t.id);
                  const isDisabled = !isSel && selections[idx].size >= MAX_PER_BURGER;
                  return `<button class="topping-chip-btn${isSel ? ' selected' : ''}${isDisabled ? ' disabled' : ''}"
                                  data-burger="${idx}" data-id="${t.id}" ${isDisabled ? 'disabled' : ''}>
                            <span class="tc-name">${t.name}</span>
                            <span class="tc-price">Incluido</span>
                          </button>`;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="pm-cancel">Cancelar</button>
          <button class="btn btn-primary btn-lg" id="pm-confirm" style="flex:1">
            🔥 Agregar promo — ${formatCurrency(promo.price)}
          </button>
        </div>
      </div>
    `;

    overlay.querySelector('#pm-close').onclick = () => overlay.remove();
    overlay.querySelector('#pm-cancel').onclick = () => overlay.remove();

    overlay.querySelectorAll('.topping-chip-btn').forEach(btn => {
      btn.onclick = () => {
        const burgerIdx = Number(btn.dataset.burger);
        const sel = selections[burgerIdx];
        const id = Number(btn.dataset.id);
        if (sel.has(id)) {
          sel.delete(id);
        } else {
          if (sel.size >= MAX_PER_BURGER) {
            toast.warning(`Cada hamburguesa admite hasta ${MAX_PER_BURGER} toppings.`);
            return;
          }
          sel.add(id);
        }
        draw();
      };
    });

    overlay.querySelector('#pm-confirm').onclick = () => {
      const allToppings = selections.flatMap((sel, idx) =>
        toppings.filter(t => sel.has(t.id)).map(t => ({ ...t, _burger: idx + 1 }))
      );
      const noteParts = selections.map((sel, idx) => {
        const names = toppings.filter(t => sel.has(t.id)).map(t => t.name).join(', ') || 'Sin toppings';
        return `Tentadora ${idx + 1}: [${names}]`;
      });
      addPromoToCart(promo, allToppings, noteParts.join(' · '), null);
      overlay.remove();
    };
  }

  draw();
  document.body.appendChild(overlay);
}

// ─── Renderizar Grid de Promociones ──────────────────────────────────────────
/**
 * Renderiza las tarjetas de promoción en un contenedor.
 * @param {HTMLElement} container
 * @param {object} opts — { compact: false } para vista mesero
 */
export function renderPromos(container, opts = {}) {
  const { compact = false } = opts;

  container.innerHTML = `
    <div class="promos-section">
      <div class="promos-header">
        <span class="promos-label">🔥 PROMOCIONES</span>
        <span class="promos-sub">Precios especiales · Toppings incluidos</span>
      </div>
      <div class="promos-grid ${compact ? 'promos-grid-compact' : ''}">
        ${PROMOTIONS.map(promo => renderPromoCard(promo, compact)).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('.promo-card').forEach(card => {
    card.addEventListener('click', async () => {
      const promoId = card.dataset.promoId;
      const promo = PROMOTIONS.find(p => p.id === promoId);
      if (!promo) return;
      if (promo.hasToppings || promo.requiresBeverage) {
        await openPromoModal(promo);
      } else {
        addPromoToCart(promo, [], '', null);
      }
    });
  });
}

export function renderPromoCard(promo, compact) {
  return `
    <div class="promo-card ${compact ? 'promo-card-compact' : ''}" data-promo-id="${promo.id}" role="button" tabindex="0">
      <div class="promo-card-icon">${promo.icon}</div>
      <div class="promo-card-body">
        <p class="promo-card-name">${promo.name}</p>
        ${!compact ? `<p class="promo-card-desc">${promo.description}</p>` : ''}
        ${promo.includes.length > 0 ? `
          <div class="promo-card-includes">
            ${promo.includes.map(inc => `<span class="promo-include-mini">✅ ${inc}</span>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="promo-card-footer">
        <span class="promo-card-price">${formatCurrency(promo.price)}</span>
        <button class="card-add-btn promo-add-btn" title="Agregar promo">+</button>
      </div>
    </div>
  `;
}
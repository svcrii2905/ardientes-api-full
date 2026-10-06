/**
 * toppingModal.js — Modal de personalización de menú y toppings para el POS (Ardientes)
 *
 * Flujo:
 * 1. Selección de Menú (Especial o Universitario) que determina el precio base del producto.
 * 2. Selección de Combo (Solo o En Combo +$5.000) - Aplica a hamburguesas y perros en Menú Universitario.
 * 3. Selección de Toppings permitidos (sin precio individual, incluidos en el costo del menú).
 * 4. Resumen interactivo en tiempo real y botón de agregar al pedido.
 */
import { addProductToCart, store } from '../store/state.js';
import { catalogService } from '../services/catalog.service.js';
import { formatCurrency } from '../utils/currency.js';
import { toast } from '../utils/notify.js';

export async function openToppingModal(product, initialMenuTypeOrCallback, maybeCallback) {
  let onConfirm = typeof maybeCallback === 'function' ? maybeCallback : (typeof initialMenuTypeOrCallback === 'function' ? initialMenuTypeOrCallback : null);
  let initialMenuType = typeof initialMenuTypeOrCallback === 'string' ? initialMenuTypeOrCallback : 'AMBOS';

  // Cargar reglas de toppings por menú
  let menuRules = store.get('menuRules');
  if (!menuRules || !menuRules.length) {
    try {
      menuRules = await catalogService.getMenuRules();
      store.set({ menuRules });
    } catch {
      menuRules = [
        { menuType: 'UNIVERSITARIO', maxToppings: 4, allowFreeSelection: true },
        { menuType: 'ESPECIAL', maxToppings: null, allowFreeSelection: true }
      ];
    }
  }

  // Cargar toppings permitidos para el producto
  let allowedToppings = [];
  try {
    allowedToppings = await catalogService.getProductToppings(product.id);
  } catch {
    toast.error('No se pudieron obtener los toppings permitidos');
    return;
  }

  // Determinar tipo de menú inicial a preseleccionar
  let selectedMenu = initialMenuType === 'AMBOS' ? 'ESPECIAL' : initialMenuType;
  
  if (product.availableIn === 'UNIVERSITARIO') {
    selectedMenu = 'UNIVERSITARIO';
  } else if (product.availableIn === 'ESPECIAL') {
    selectedMenu = 'ESPECIAL';
  }

  // Selección de toppings
  const selectedToppings = new Set();

  // Buscar toppings especiales en el listado permitido
  const cheeseTopping = allowedToppings.find(t => t.name.toLowerCase().includes('lluvia de queso'));
  const comboTopping = allowedToppings.find(t => t.name.toLowerCase().includes('combo universitario'));

  // Estado del combo (Solo / En Combo) para el menú Universitario
  // Aplica a Hamburguesas (category_id = 1) y Perros Calientes (category_id = 2)
  const category = store.get('categories')?.find(c => c.id === product.categoryId);
  const categoryName = category?.name?.toLowerCase() || '';
  const isComboEligible = product.categoryId === 1 || product.categoryId === 2 ||
                          categoryName.includes('hamburguesa') || categoryName.includes('perro');
  let isComboSelected = false;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'topping-modal-overlay';

  let domInitialized = false;

  function initDOM(maxToppings) {
    if (domInitialized) return;
    
    // Calculate initial prices and counts to render the base DOM
    const isUniversitario = selectedMenu === 'UNIVERSITARIO';
    const isEspecial = selectedMenu === 'ESPECIAL';
    const priceBase = isUniversitario 
      ? (product.priceUniversitario ?? product.priceEspecial)
      : (product.priceEspecial ?? product.priceUniversitario);

    overlay.innerHTML = `
      <div class="modal topping-modal" style="max-width:560px;">
        <div class="modal-header">
          <div style="display:flex;flex-direction:column;gap:4px">
            <h2 class="modal-title">🔥 Personalizar Producto</h2>
            <span style="font-size:var(--text-xs);color:var(--text-muted)">
              Ajusta los detalles para el pedido de tu cliente
            </span>
          </div>
          <button type="button" class="btn btn-ghost btn-icon" id="tm-close">✕</button>
        </div>

        <div class="modal-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
          
          <!-- Nombre del producto -->
          <div style="background:var(--bg-card);padding:var(--space-3) var(--space-4);border-radius:var(--radius-lg);
                      border:1px solid var(--border-subtle)">
            <h3 style="font-size:var(--text-base);font-weight:800;color:var(--text-primary)">${product.name}</h3>
            <p style="font-size:var(--text-xs);color:var(--text-muted);margin-top:2px">${product.description || ''}</p>
          </div>

          <!-- 1. Elige tu menú -->
          <div>
            <p style="font-size:var(--text-xs);font-weight:700;color:var(--text-secondary);
                      text-transform:uppercase;margin-bottom:var(--space-2)">
              1. Selecciona el Tipo de Menú
            </p>
            <div style="display:flex;gap:var(--space-3)">
              <button type="button" class="menu-select-card" id="btn-menu-especial" 
                      ${product.availableIn === 'UNIVERSITARIO' ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
                <span style="font-size:1.3rem">⭐</span>
                <span style="font-weight:700;margin-top:4px;font-size:var(--text-sm)">MENÚ ESPECIAL</span>
                <span style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:2px">
                  ${product.priceEspecial ? formatCurrency(product.priceEspecial) : 'No disponible'}
                </span>
              </button>
              <button type="button" class="menu-select-card" id="btn-menu-universitario"
                      ${product.availableIn === 'ESPECIAL' ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
                <span style="font-size:1.3rem">🎓</span>
                <span style="font-weight:700;margin-top:4px;font-size:var(--text-sm)">MENÚ UNIVERSITARIO</span>
                <span style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:2px">
                  ${product.priceUniversitario ? formatCurrency(product.priceUniversitario) : 'No disponible'}
                </span>
              </button>
            </div>
          </div>

          <!-- Opción de Combo (Sólo para hamburguesas/perros en Menú Universitario) -->
          <div class="panel combo-selection-panel" id="combo-panel" style="display:none; padding:var(--space-3) var(--space-4);
                      background:linear-gradient(135deg, rgba(255,165,0,0.06), rgba(255,85,0,0.03));
                      border-color:var(--border-medium);animation:fadeIn 250ms ease;">
            <p style="font-size:var(--text-xs);font-weight:700;color:var(--text-secondary);
                      text-transform:uppercase;margin-bottom:var(--space-2)">
              ¿Quieres convertirlo en combo?
            </p>
            <div style="display:flex;gap:var(--space-2)">
              <button type="button" class="btn btn-primary btn-sm" id="btn-combo-solo" style="flex:1">
                🍔 Sin combo (<span id="combo-solo-price">${formatCurrency(priceBase)}</span>)
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-combo-si" style="flex:1">
                🍟 +$5.000 — Papitas + Gaseosa
              </button>
            </div>
          </div>

          <!-- 2. Elige tus toppings -->
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
              <p style="font-size:var(--text-xs);font-weight:700;color:var(--text-secondary);text-transform:uppercase">
                2. Elige tus toppings (Gratis)
              </p>
              <span id="tm-topping-counter" style="font-size:var(--text-xs);font-weight:700;margin-left:auto"></span>
            </div>
            <div class="toppings-selection-grid" id="toppings-grid">
              ${allowedToppings.filter(t => t.id !== comboTopping?.id).map(t => `
                <button type="button" class="topping-chip-btn" data-id="${t.id}" id="topping-btn-${t.id}">
                  <span class="tc-name">${t.name}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- 3. Resumen -->
          <div style="background:var(--bg-card);padding:var(--space-3) var(--space-4);border-radius:var(--radius-lg);
                      border:1px solid var(--border-medium);display:flex;flex-direction:column;gap:4px">
            <p style="font-size:var(--text-xs);color:var(--text-muted);font-weight:700;text-transform:uppercase">
              Resumen del item
            </p>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:700;font-size:var(--text-sm)">${product.name}</span>
              <span id="tm-final-price" style="font-weight:800;color:var(--amber-500);font-size:var(--text-lg)"></span>
            </div>
            <p style="font-size:var(--text-xs);color:var(--text-secondary)" id="tm-summary-text"></p>
            <div id="tm-summary-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px"></div>
          </div>

        </div><!-- /modal-body -->

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="tm-cancel">Cancelar</button>
          <button type="button" class="btn btn-primary btn-lg" id="tm-confirm" style="flex:1">
            🔥 Agregar al pedido
          </button>
        </div>
      </div>
    `;

    bindEvents(maxToppings);
    domInitialized = true;
  }

  function draw() {
    const isUniversitario = selectedMenu === 'UNIVERSITARIO';
    const isEspecial = selectedMenu === 'ESPECIAL';
    const rule = menuRules.find(r => r.menuType === selectedMenu) || { maxToppings: null };
    const maxToppings = rule.maxToppings;

    // Inicializar el DOM una sola vez
    initDOM(maxToppings);

    // Ajustar selecciones de toppings especiales según el menú
    if (isEspecial && cheeseTopping) {
      selectedToppings.add(cheeseTopping.id);
    } else if (cheeseTopping && isUniversitario) {
      selectedToppings.delete(cheeseTopping.id);
    }

    if (isUniversitario && isComboSelected && comboTopping) {
      selectedToppings.add(comboTopping.id);
    } else if (comboTopping) {
      selectedToppings.delete(comboTopping.id);
    }

    // Actualizar UI
    const btnEspecial = overlay.querySelector('#btn-menu-especial');
    const btnUniversitario = overlay.querySelector('#btn-menu-universitario');
    
    if (btnEspecial) btnEspecial.className = `menu-select-card${isEspecial ? ' active' : ''}`;
    if (btnUniversitario) btnUniversitario.className = `menu-select-card${isUniversitario ? ' active' : ''}`;

    const comboPanel = overlay.querySelector('#combo-panel');
    if (comboPanel) {
      comboPanel.style.display = (isUniversitario && isComboEligible) ? 'block' : 'none';
      const btnSolo = overlay.querySelector('#btn-combo-solo');
      const btnSi = overlay.querySelector('#btn-combo-si');
      if (btnSolo) btnSolo.className = `btn ${!isComboSelected ? 'btn-primary' : 'btn-secondary'} btn-sm`;
      if (btnSi) btnSi.className = `btn ${isComboSelected ? 'btn-primary' : 'btn-secondary'} btn-sm`;
      
      const priceBase = isUniversitario 
        ? (product.priceUniversitario ?? product.priceEspecial)
        : (product.priceEspecial ?? product.priceUniversitario);
      const comboSoloPrice = overlay.querySelector('#combo-solo-price');
      if (comboSoloPrice) comboSoloPrice.textContent = formatCurrency(priceBase);
    }

    allowedToppings.filter(t => t.id !== comboTopping?.id).forEach(t => {
      const btn = overlay.querySelector(`#topping-btn-${t.id}`);
      if (!btn) return;
      
      const isSelected = selectedToppings.has(t.id);
      const isCheeseSpecial = isEspecial && cheeseTopping && t.id === cheeseTopping.id;
      
      if (isCheeseSpecial) {
        btn.style.display = '';
        btn.className = 'topping-chip-btn selected disabled';
        btn.style.cursor = 'not-allowed';
        btn.style.opacity = '0.9';
        btn.innerHTML = `<span class="tc-name">✓ ${t.name}</span><span class="tc-price">Incluido en Especial</span>`;
      } else if (isUniversitario && cheeseTopping && t.id === cheeseTopping.id) {
        btn.style.display = 'none';
      } else {
        btn.style.display = '';
        btn.style.cursor = 'pointer';
        btn.style.opacity = '1';
        btn.className = `topping-chip-btn${isSelected ? ' selected' : ''}`;
        btn.style.cursor = 'pointer';
        btn.style.opacity = '1';
        btn.innerHTML = `<span class="tc-name">${t.name}</span>`;
      }
    });

    // Actualizar resumen de texto
    const summaryText = overlay.querySelector('#tm-summary-text');
    if (summaryText) {
      let html = `Modalidad: <span style="font-weight:700;color:var(--fire-300)">Menú ${selectedMenu}</span>`;
      if (isUniversitario && isComboSelected) html += ' · <span style="font-weight:700;color:var(--status-online)">En Combo</span>';
      if (isEspecial) html += ' · <span style="font-weight:700;color:var(--status-online)">🥔 Con papas incluidas</span>';
      summaryText.innerHTML = html;
    }

    updateSummary(maxToppings);
  }


  function updateSummary(maxToppings) {
    const isUniversitario = selectedMenu === 'UNIVERSITARIO';
    const isEspecial = selectedMenu === 'ESPECIAL';

    // Obtener precio base correspondiente al menú seleccionado
    const priceBase = isUniversitario 
      ? (product.priceUniversitario ?? product.priceEspecial)
      : (product.priceEspecial ?? product.priceUniversitario);

    // Contador de toppings normales
    const normalToppingsCount = Array.from(selectedToppings).filter(tid => {
      if (comboTopping && tid === comboTopping.id) return false;
      if (isEspecial && cheeseTopping && tid === cheeseTopping.id) return false;
      return true;
    }).length;

    // Recargo por toppings adicionales en Menú Universitario (+1.000 por cada topping a partir del 5º)
    const extraToppingsCount = isUniversitario ? Math.max(0, normalToppingsCount - 4) : 0;
    const extraToppingsSurcharge = extraToppingsCount * 1000;

    // Calcular precio final
    let extraTotal = 0;
    const selectedList = allowedToppings.filter(t => selectedToppings.has(t.id));
    for (const t of selectedList) {
      if (t.id === comboTopping?.id) {
        extraTotal += t.extraPrice;
      }
    }
    const finalPrice = priceBase + extraTotal + extraToppingsSurcharge;

    // Actualizar Contador
    const counterEl = overlay.querySelector('#tm-topping-counter');
    if (counterEl) {
      if (isUniversitario) {
        if (extraToppingsCount > 0) {
          counterEl.textContent = `Toppings: ${normalToppingsCount} (+${formatCurrency(extraToppingsSurcharge)} adicional)`;
        } else {
          counterEl.textContent = `Toppings: ${normalToppingsCount} (4 incluidos)`;
        }
      } else {
        counterEl.textContent = `♾️ Toppings ilimitados gratis`;
      }
    }

    // Actualizar Precio Final
    const priceEl = overlay.querySelector('#tm-final-price');
    if (priceEl) {
      priceEl.textContent = formatCurrency(finalPrice);
    }

    // Actualizar Badges
    const badgesEl = overlay.querySelector('#tm-summary-badges');
    if (badgesEl) {
      let badgesHtml = '';
      if (isEspecial) {
        badgesHtml += `<span class="badge badge-green" style="font-size:10px">🥔 Porción de papa incluida</span>`;
      }
      if (isUniversitario && isComboSelected) {
        badgesHtml += `
          <span class="badge badge-green" style="font-size:10px">+ Papitas</span>
          <span class="badge badge-green" style="font-size:10px">+ Gaseosa</span>
          <span class="badge badge-amber" style="font-size:10px">Adicional combo: ${formatCurrency(5000)}</span>
        `;
      }
      if (extraToppingsCount > 0) {
        badgesHtml += `<span class="badge badge-amber" style="font-size:10px">Toppings adic. (${extraToppingsCount}): +${formatCurrency(extraToppingsSurcharge)}</span>`;
      }
      badgesHtml += Array.from(selectedToppings).filter(tid => tid !== comboTopping?.id).map(tid => {
        const t = allowedToppings.find(x => x.id === tid);
        if (!t) return '';
        return `<span class="badge badge-fire" style="font-size:10px">+ ${t.name}</span>`;
      }).join('');
      if (normalToppingsCount === 0 && !isComboSelected && !isEspecial) {
        badgesHtml += '<span style="font-size:var(--text-xs);color:var(--text-muted)">Sin toppings seleccionados</span>';
      }
      badgesEl.innerHTML = badgesHtml;
    }
  }

  function bindEvents(maxToppings) {
    overlay.querySelector('#tm-close').onclick = () => overlay.remove();
    overlay.querySelector('#tm-cancel').onclick = () => overlay.remove();

    // Menú Especial
    const btnEspecial = overlay.querySelector('#btn-menu-especial');
    if (btnEspecial) {
      btnEspecial.onclick = () => {
        if (product.availableIn === 'UNIVERSITARIO') return;
        selectedMenu = 'ESPECIAL';
        isComboSelected = false; // Desactivar combo
        draw();
      };
    }

    // Menú Universitario
    const btnUniversitario = overlay.querySelector('#btn-menu-universitario');
    if (btnUniversitario) {
      btnUniversitario.onclick = () => {
        if (product.availableIn === 'ESPECIAL') return;
        selectedMenu = 'UNIVERSITARIO';
        draw();
      };
    }

    // Botones del combo
    const btnComboSolo = overlay.querySelector('#btn-combo-solo');
    if (btnComboSolo) {
      btnComboSolo.onclick = () => {
        isComboSelected = false;
        draw();
      };
    }

    const btnComboSi = overlay.querySelector('#btn-combo-si');
    if (btnComboSi) {
      btnComboSi.onclick = () => {
        isComboSelected = true;
        draw();
      };
    }

    // Toppings
    overlay.querySelectorAll('.topping-chip-btn:not(.disabled)').forEach(btn => {
      btn.onclick = () => {
        const id = Number(btn.dataset.id);
        
        if (selectedToppings.has(id)) {
          selectedToppings.delete(id);
          btn.classList.remove('selected');
        } else {
          selectedToppings.add(id);
          btn.classList.add('selected');
        }
        updateSummary(maxToppings);
      };
    });

    // Agregar al pedido
    overlay.querySelector('#tm-confirm').onclick = () => {
      // DTO de toppings
      const toppings = allowedToppings
        .filter(t => selectedToppings.has(t.id))
        .map(t => {
          const isCombo = comboTopping && t.id === comboTopping.id;
          return {
            toppingId: t.id,
            toppingName: t.name,
            name: t.name,
            extraPrice: isCombo ? t.extraPrice : 0, // El combo conserva su precio de $5000, los adiciones normales van a $0
            quantity: 1
          };
        });

      // Crear nota del item si está en combo para persistencia en base de datos
      const notes = isComboSelected ? "En Combo (+ Papitas + Gaseosa)" : "";

      const isUniversitario = selectedMenu === 'UNIVERSITARIO';
      const priceBase = isUniversitario 
        ? (product.priceUniversitario ?? product.priceEspecial)
        : (product.priceEspecial ?? product.priceUniversitario);

      if (onConfirm) {
        const customizedItem = {
          productId: product.id,
          name: product.name,
          qty: 1,
          quantity: 1,
          menuType: selectedMenu,
          unitPrice: priceBase,
          toppings,
          notes,
        };
        onConfirm(customizedItem);
      } else {
        addProductToCart(product, selectedMenu, toppings);
        
        // Actualizar la nota del item recién agregado
        const cart = store.get('cart');
        if (cart.items.length > 0 && notes) {
          const lastItem = cart.items[cart.items.length - 1];
          lastItem.notes = notes;
          store.set({ cart });
        }
      }

      toast.success(`${product.name} (Menú ${selectedMenu}) agregado 🔥`);
      overlay.remove();
    };
  }

  draw();
  document.body.appendChild(overlay);
}

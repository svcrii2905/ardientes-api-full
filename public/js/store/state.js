/**
 * state.js — Estado reactivo global de Ardientes POS
 * Simple Observable pattern sin dependencias externas.
 */

function createStore(initial) {
  let state = { ...initial };
  const listeners = new Map();

  return {
    /** Lee el estado completo o una clave específica */
    get(key) {
      return key ? state[key] : { ...state };
    },

    /** Actualiza claves del estado y notifica suscriptores */
    set(updates) {
      const prev = { ...state };
      state = { ...state, ...updates };

      // Notificar suscriptores de cada clave cambiada
      for (const key of Object.keys(updates)) {
        const keyListeners = listeners.get(key) ?? [];
        keyListeners.forEach(cb => cb(state[key], prev[key]));
      }
      // Notificar suscriptores globales ('*')
      const global = listeners.get('*') ?? [];
      global.forEach(cb => cb(state, prev));
    },

    /** Suscribirse a cambios de una clave o '*' para cualquier cambio */
    subscribe(key, callback) {
      if (!listeners.has(key)) listeners.set(key, []);
      listeners.get(key).push(callback);
      // Retorna función para desuscribirse
      return () => {
        const arr = listeners.get(key) ?? [];
        const idx = arr.indexOf(callback);
        if (idx !== -1) arr.splice(idx, 1);
      };
    },
  };
}

export const store = createStore({
  /** Pestaña activa en el sidebar */
  activeView: 'pos',

  /** Estado de la conexión con el backend */
  apiOnline: false,

  /** Tipo de menú activo: 'UNIVERSITARIO' | 'ESPECIAL' */
  menuType: 'AMBOS',

  /** Categoría seleccionada en el POS (null = Todos) */
  selectedCategory: null,

  /** Término de búsqueda en el POS */
  searchQuery: '',

  /** Carrito de compras / pedido actual */
  cart: {
    orderType: 'RECOGER',
    tableId: null,
    deliveryAddress: '',     // Requerido si orderType === 'DOMICILIO'
    customerId: null,
    customer: null,          // Cliente seleccionado { id, fullName, phone, loyaltyPoints, ... }
    notes: '',
    items: [],       // { productId, name, qty, unitPrice, menuType, toppings[], lineTotal }
    beverages: [],   // { beverageId, name, qty, unitPrice, lineTotal }
    combos: [],      // { comboId, name, qty, unitPrice, lineTotal }
    disposableFee: 1000,     // Cargo de desechables: MESA: $0, RECOGER/DOMICILIO: $1.000
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    total: 0,
  },

  /** Sesión de caja activa */
  cashSession: null,

  /** Usuario actual */
  currentUser: null,

  /** Caché de categorías */
  categories: [],

  /** Caché de productos */
  products: [],

  /** Métodos de pago disponibles */
  paymentMethods: [],

  /** El pedido que acaba de ser confirmado (para mostrar recibo) */
  lastOrder: null,
});

// ─── Helpers del carrito ──────────────────────────────────────────────────

export function recalcCart() {
  const cart = store.get('cart');
  const TAX = 0;

  let subtotal = 0;
  for (const item of cart.items) {
    const isUniversitario = item.menuType === 'UNIVERSITARIO';
    const normalToppings = (item.toppings ?? []).filter(t => {
      const name = (t.toppingName || t.name || '').toLowerCase();
      return !name.includes('combo universitario');
    });
    const extraToppingsCount = isUniversitario ? Math.max(0, normalToppings.length - 4) : 0;
    const extraToppingsSurcharge = extraToppingsCount * 1000;

    const toppingExtra = item.toppings.reduce((s, t) => s + (t.extraPrice * (t.quantity || 1)), 0) + extraToppingsSurcharge;
    item.lineTotal = (item.unitPrice + toppingExtra) * item.qty;
    subtotal += item.lineTotal;
  }
  for (const b of cart.beverages) {
    b.lineTotal = b.unitPrice * b.qty;
    subtotal += b.lineTotal;
  }
  for (const c of cart.combos) {
    c.lineTotal = c.unitPrice * c.qty;
    subtotal += c.lineTotal;
  }

  // Regla de Desechables: MESA: $0; RECOGER (Para llevar): +$1.000; DOMICILIO: +$1.000
  const hasItems = cart.items.length > 0 || cart.beverages.length > 0 || cart.combos.length > 0;
  const disposableFee = hasItems && (cart.orderType === 'RECOGER' || cart.orderType === 'DOMICILIO') ? 1000 : 0;

  const total = subtotal + disposableFee - (cart.discountAmount || 0);
  const taxAmount = parseFloat((total * TAX / (1 + TAX)).toFixed(2));

  store.set({
    cart: {
      ...cart,
      disposableFee,
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxAmount,
      total: parseFloat(total.toFixed(2)),
    },
  });
}

export function addProductToCart(product, menuType, toppings = []) {
  const cart = store.get('cart');

  // 'AMBOS' es el filtro de UI "mostrar todos los productos" pero NO es un menuType válido
  // para un ítem de pedido. Resolver al menú concreto según disponibilidad del producto.
  let resolvedMenuType = menuType;
  if (menuType === 'AMBOS') {
    // Si el producto sólo está en un menú, usar ese
    if (product.availableIn === 'UNIVERSITARIO') resolvedMenuType = 'UNIVERSITARIO';
    else if (product.availableIn === 'ESPECIAL')  resolvedMenuType = 'ESPECIAL';
    else resolvedMenuType = 'ESPECIAL'; // availableIn === 'AMBOS' → usar ESPECIAL como default
  }

  // Precio según tipo de menú resuelto
  const unitPrice =
    resolvedMenuType === 'UNIVERSITARIO' ? (product.priceUniversitario ?? product.priceEspecial)
    : (product.priceEspecial ?? product.priceUniversitario);

  // ¿Ya existe en el carrito (mismo producto + mismo tipo de menú + mismos toppings)?
  const toppingKey = toppings.map(t => t.toppingId).sort().join(',');
  const existing = cart.items.find(
    i => i.productId === product.id &&
         i.menuType === resolvedMenuType &&
         i.toppings.map(t => t.toppingId).sort().join(',') === toppingKey
  );

  let items;
  if (existing) {
    items = cart.items.map(i =>
      i === existing ? { ...i, qty: i.qty + 1 } : i
    );
  } else {
    items = [
      ...cart.items,
      {
        productId: product.id,
        name: product.name,
        qty: 1,
        unitPrice,
        menuType: resolvedMenuType,
        toppings,
        lineTotal: unitPrice,
        _key: crypto.randomUUID(),
      },
    ];
  }

  store.set({ cart: { ...cart, items } });
  recalcCart();
}

export function updateCartItemQty(key, delta) {
  const cart = store.get('cart');
  const items = cart.items
    .map(i => i._key === key ? { ...i, qty: i.qty + delta } : i)
    .filter(i => i.qty > 0);
  store.set({ cart: { ...cart, items } });
  recalcCart();
}

export function removeCartItem(key) {
  const cart = store.get('cart');
  store.set({ cart: { ...cart, items: cart.items.filter(i => i._key !== key) } });
  recalcCart();
}

export function clearCart() {
  store.set({
    cart: {
      orderType: 'RECOGER',
      tableId: null,
      deliveryAddress: '',
      customerId: null,
      customer: null,
      notes: '',
      items: [],
      beverages: [],
      combos: [],
      disposableFee: 0,
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
    },
  });
}

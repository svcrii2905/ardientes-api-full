/**
 * config.js — Configuración del cliente frontend Ardientes POS
 * Sólo valores seguros para el navegador (sin secretos del .env).
 */
export const CONFIG = {
  /** URL base de la API REST. Si el frontend corre en el mismo origen, usar '/'. */
  API_BASE: '',

  /** Impuesto al consumo Colombia (8%) ya incluido en los precios del seed */
  TAX_PERCENTAGE: 0.08,
  TAX_INCLUDED_IN_PRICES: true,

  /** Moneda */
  CURRENCY_SYMBOL: '$',
  CURRENCY_CODE: 'COP',

  /** Intervalo de verificación de la API (ms) */
  HEALTH_CHECK_INTERVAL: 15000,

  /** Opciones de tipo de pedido */
  ORDER_TYPES: [
    { value: 'MESA',     label: 'Mesa',      icon: '🪑' },
    { value: 'RECOGER',  label: 'Para llevar', icon: '🥡' },
    { value: 'DOMICILIO',label: 'Domicilio',  icon: '🛵' },
  ],

  /** Estados de pedido con etiqueta y color */
  ORDER_STATUSES: {
    PENDIENTE:      { label: 'Pendiente',     color: '#9CA3AF', icon: '⏳' },
    CONFIRMADO:     { label: 'Confirmado',    color: '#60A5FA', icon: '✅' },
    EN_PREPARACION: { label: 'Preparando',    color: '#FBBF24', icon: '🍳' },
    LISTO:          { label: 'Listo',         color: '#34D399', icon: '🔔' },
    EN_CAMINO:      { label: 'En camino',     color: '#8B5CF6', icon: '🛵' },
    ENTREGADO:      { label: 'Entregado',     color: '#10B981', icon: '🎉' },
    CANCELADO:      { label: 'Cancelado',     color: '#F87171', icon: '❌' },
  },

  /** Íconos de categorías (fallback si la categoría no tiene icon_url) */
  CATEGORY_ICONS: {
    'Hamburguesas':           '🍔',
    'Perros Calientes':       '🌭',
    'Salchipapas':            '🍟',
    'Mazorcadas':             '🌽',
    'Plátanos':               '🍌',
    'Portolocos':             '🧀',
    'Combo Mini Hamburguesas':'🍱',
    'Bebidas':                '🥤',
    'Entradas':               '🍟',
    'Otros':                  '🍽️',
  },

  /** Íconos de métodos de pago */
  PAYMENT_METHOD_ICONS: {
    'EFECTIVO': '💵',
    'TARJETA':  '💳',
    'NEQUI':    '📱',
    'DAVIPLATA':'📲',
    'OTRO':     '💰',
  },
};

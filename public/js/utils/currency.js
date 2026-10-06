/**
 * currency.js — Utilidades de formato monetario para Ardientes POS (COP)
 */
export function formatCurrency(amount, symbol = '$') {
  if (amount === null || amount === undefined) return `${symbol}0`;
  return `${symbol}${Number(amount).toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function parseCurrency(str) {
  return parseFloat(String(str).replace(/[^0-9.]/g, '')) || 0;
}

/**
 * Calcula el cambio cuando el cliente paga en efectivo.
 */
export function calcChange(amountPaid, total) {
  return Math.max(0, amountPaid - total);
}

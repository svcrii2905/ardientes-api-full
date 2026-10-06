/**
 * notify.js — Sistema de notificaciones tipo Toast para Ardientes POS
 */

let container = null;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Muestra un toast de notificación.
 * @param {string} message - Texto del mensaje
 * @param {'success'|'error'|'warning'|'info'} type - Tipo de notificación
 * @param {number} duration - Milisegundos antes de desaparecer (0 = permanente)
 */
export function notify(message, type = 'info', duration = 3500) {
  const c = getContainer();
  const icons = {
    success: '✅',
    error:   '❌',
    warning: '⚠️',
    info:    '🔥',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${icons[type]}</span>
    <span style="flex:1">${message}</span>
  `;

  c.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => dismiss(toast), duration);
  }

  return toast;
}

function dismiss(toast) {
  toast.classList.add('out');
  setTimeout(() => toast.remove(), 300);
}

export const toast = {
  success: (msg, dur) => notify(msg, 'success', dur),
  error:   (msg, dur) => notify(msg, 'error', dur),
  warning: (msg, dur) => notify(msg, 'warning', dur),
  info:    (msg, dur) => notify(msg, 'info', dur),
};

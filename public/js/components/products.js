/**
 * products.js — Vista de administración de productos
 * Conecta con: GET /api/v1/catalog/products y /api/v1/catalog/categories
 */
import { catalogService } from '../services/catalog.service.js';
import { formatCurrency } from '../utils/currency.js';

export async function renderProducts(container) {
  container.innerHTML = `
    <div class="page-layout">
      <div class="page-header">
        <h1 class="page-title">🍔 Productos</h1>
        <div style="display:flex;gap:var(--space-3)">
          <select class="input" id="prod-filter-cat" style="width:200px">
            <option value="">Todas las categorías</option>
          </select>
          <button class="btn btn-primary btn-sm" id="btn-refresh-products">🔄 Actualizar</button>
        </div>
      </div>
      <div class="page-body" id="products-body">
        <div style="text-align:center;padding:var(--space-10);color:var(--text-muted)">
          <div class="spinner" style="margin:0 auto var(--space-4)"></div>
          Cargando productos...
        </div>
      </div>
    </div>
  `;

  await loadProductsPage(container);

  container.querySelector('#btn-refresh-products')?.addEventListener('click', () => loadProductsPage(container));
  container.querySelector('#prod-filter-cat')?.addEventListener('change', () => loadProductsPage(container));
}

async function loadProductsPage(container) {
  const body  = container.querySelector('#products-body');
  const catEl = container.querySelector('#prod-filter-cat');

  try {
    const [cats, products] = await Promise.all([
      catalogService.getCategories(),
      catalogService.getProducts({ categoryId: catEl?.value ? Number(catEl.value) : undefined, all: true }),
    ]);

    // Rellenar selector de categorías
    if (catEl && catEl.options.length <= 1) {
      cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        catEl.appendChild(opt);
      });
    }

    const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));
    renderProductsTable(body, products, catMap);

  } catch (e) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <p>Error al cargar: ${e.message}</p>
      </div>`;
  }
}

function renderProductsTable(body, products, catMap) {
  if (!products.length) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <p>No hay productos registrados</p>
      </div>`;
    return;
  }

  body.innerHTML = `
    <div class="panel" style="padding:0;overflow:hidden">
      <table class="data-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Precio Uni.</th>
            <th>Precio Esp.</th>
            <th>Menú</th>
            <th>Toppings</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td><code style="font-size:var(--text-xs);color:var(--text-muted)">${p.sku}</code></td>
              <td><strong>${p.name}</strong></td>
              <td>${catMap[p.categoryId] || p.categoryId}</td>
              <td>${p.priceUniversitario !== null ? formatCurrency(p.priceUniversitario) : '—'}</td>
              <td>${p.priceEspecial !== null ? formatCurrency(p.priceEspecial) : '—'}</td>
              <td>
                <span class="badge ${p.availableIn === 'AMBOS' ? 'badge-green' : 'badge-amber'}">
                  ${p.availableIn}
                </span>
              </td>
              <td>${p.hasToppings ? '✅' : '—'}</td>
              <td>
                <span class="badge ${p.isActive ? 'badge-green' : 'badge-gray'}">
                  ${p.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p style="color:var(--text-muted);font-size:var(--text-xs);margin-top:var(--space-3)">
      💡 Edición de productos disponible en próximas versiones del sistema.
    </p>
  `;
}

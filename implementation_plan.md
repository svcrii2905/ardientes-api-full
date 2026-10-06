# Arquitectura de Datos — Sistema POS "Ardientes"
> Plano de entidades, relaciones y reglas de negocio · Deno + Oak + MySQL · Clean Architecture

---

## Visión General

**Ardientes** es un sistema de punto de venta para restaurante de comida rápida con características avanzadas: menús diferenciados (universitario / especial), toppings configurables por tipo de menú, pedidos multicanal (mesa, recoger, domicilio), promociones dinámicas, fidelización de clientes e inventario con alertas.

El diseño sigue **Domain-Driven Design (DDD)** con **Clean Architecture** en capas:
```
┌─────────────────────────────────────────────┐
│           Presentation (Oak / Routes)        │
├─────────────────────────────────────────────┤
│        Application (Use Cases / DTOs)        │
├─────────────────────────────────────────────┤
│          Domain (Entities / Rules)           │
├─────────────────────────────────────────────┤
│   Infrastructure (MySQL / Repos / Services)  │
└─────────────────────────────────────────────┘
```

---

## Bounded Contexts (Dominios)

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   IAM Context   │   │  Catalog Context │   │  Order Context  │
│  usuarios/roles │   │ productos/bebidas│   │ pedidos/detalle │
│    permisos     │   │ toppings/promos  │   │  mesa/domicilio │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                      │
┌────────┴──────────────────────┴──────────────────────┴────────┐
│                    Shared Kernel                               │
│        IDs, Money (precio/moneda), Timestamps, Enums           │
└────────────────────────────────────────────────────────────────┘
         │                     │                      │
┌────────┴────────┐   ┌────────┴────────┐   ┌────────┴────────┐
│ Customer Context│   │Inventory Context│   │ Report Context  │
│ clientes/histor │   │entradas/salidas │   │ ventas/KPIs     │
│ fidelización    │   │alertas/stock    │   │ tendencias      │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## Módulo 1 — IAM (Identidad y Acceso)

### Entidades

#### `users` — Usuarios del sistema (empleados/admins)
| Campo | Tipo | Restricción | Justificación |
|-------|------|-------------|---------------|
| `id` | BIGINT UNSIGNED PK AUTO_INCREMENT | NOT NULL | Surrogate key; desacopla identidad de negocio |
| `username` | VARCHAR(60) | UNIQUE NOT NULL | Login único |
| `email` | VARCHAR(120) | UNIQUE NOT NULL | Canal de recuperación |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt/argon2; nunca plano |
| `full_name` | VARCHAR(120) | NOT NULL | Presentación en UI |
| `role_id` | BIGINT FK → roles.id | NOT NULL | Rol único activo; permisos por rol |
| `is_active` | TINYINT(1) | DEFAULT 1 | Soft-disable sin borrar historial |
| `last_login_at` | DATETIME | NULL | Auditoría de acceso |
| `created_at` | DATETIME | DEFAULT NOW() | Trazabilidad |
| `updated_at` | DATETIME | ON UPDATE NOW() | Trazabilidad |

> **Decisión**: Se usa un **único rol activo** (no tabla junction) para simplificar permisos en un POS de restaurante. Si en el futuro se requieren múltiples roles, se migra a `user_roles` sin tocar la capa de dominio.

#### `roles` — Roles del sistema
| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | BIGINT UNSIGNED PK | |
| `name` | VARCHAR(60) | UNIQUE NOT NULL |
| `description` | VARCHAR(255) | NULL |
| `created_at` | DATETIME | DEFAULT NOW() |

Roles semilla: `ADMIN`, `CAJERO`, `COCINA`, `DOMICILIARIO`, `SUPERVISOR`

#### `permissions` — Permisos atómicos
| Campo | Tipo |
|-------|------|
| `id` | BIGINT UNSIGNED PK |
| `code` | VARCHAR(80) UNIQUE NOT NULL — ej. `orders:create`, `inventory:read` |
| `description` | VARCHAR(255) |

#### `role_permissions` — Junction roles ↔ permisos
| Campo | Tipo |
|-------|------|
| `role_id` | BIGINT FK → roles.id |
| `permission_id` | BIGINT FK → permissions.id |
| PK compuesta: `(role_id, permission_id)` | |

> **Justificación SOLID**: Principio de Responsabilidad Única. La tabla `permissions` permite auditar y ajustar permisos sin tocar código.

---

## Módulo 2 — Catálogo de Productos

### Entidades

#### `categories` — Categorías de productos
| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | BIGINT UNSIGNED PK | |
| `name` | VARCHAR(80) | UNIQUE NOT NULL — ej. `HAMBURGUESA`, `PIZZA`, `COMBO` |
| `icon_url` | VARCHAR(255) | NULL |
| `sort_order` | SMALLINT | DEFAULT 0 — Orden en menú |
| `is_active` | TINYINT(1) | DEFAULT 1 |

#### `products` — Productos del menú
| Campo | Tipo | Restricción | Justificación |
|-------|------|-------------|---------------|
| `id` | BIGINT UNSIGNED PK | | |
| `category_id` | BIGINT FK → categories.id | NOT NULL | |
| `sku` | VARCHAR(30) | UNIQUE NOT NULL | Código interno para inventario |
| `name` | VARCHAR(120) | NOT NULL | |
| `description` | TEXT | NULL | |
| `base_price` | DECIMAL(10,2) | NOT NULL | Precio base sin toppings |
| `image_url` | VARCHAR(255) | NULL | |
| `is_active` | TINYINT(1) | DEFAULT 1 | Soft-delete |
| `has_toppings` | TINYINT(1) | DEFAULT 0 | Flag: ¿este producto acepta toppings? |
| `menu_type` | ENUM('UNIVERSITARIO','ESPECIAL','AMBOS') | DEFAULT 'AMBOS' | Regla de negocio clave |
| `created_at` | DATETIME | DEFAULT NOW() | |
| `updated_at` | DATETIME | ON UPDATE NOW() | |

> **Decisión `menu_type`**: Las reglas de toppings difieren radicalmente entre menú universitario (máx 4) y especial (todos). Este campo en el producto permite filtrar el catálogo correcto sin lógica de aplicación compleja.

#### `beverages` — Bebidas (catálogo separado)
| Campo | Tipo | Restricción | Justificación |
|-------|------|-------------|---------------|
| `id` | BIGINT UNSIGNED PK | | |
| `name` | VARCHAR(80) | NOT NULL | |
| `sku` | VARCHAR(30) | UNIQUE NOT NULL | |
| `size` | ENUM('PEQUEÑO','MEDIANO','GRANDE','FAMILIAR') | NOT NULL | |
| `price` | DECIMAL(10,2) | NOT NULL | |
| `stock_qty` | INT | DEFAULT 0 | Inventario simple de bebidas |
| `is_active` | TINYINT(1) | DEFAULT 1 | |

> **Decisión**: Las bebidas son entidad separada porque tienen lógica propia (tamaños, stock directo, aparecen en promociones de forma distinta). Mezclarlas con `products` generaría campos nulos y violaría el Principio de Segregación de Interfaces.

#### `toppings` — Catálogo maestro de toppings
| Campo | Tipo | Restricción | Justificación |
|-------|------|-------------|---------------|
| `id` | BIGINT UNSIGNED PK | | |
| `name` | VARCHAR(80) | NOT NULL | ej. `Jalapeño`, `Tocino`, `Queso extra` |
| `extra_price` | DECIMAL(10,2) | DEFAULT 0.00 | Precio adicional si aplica |
| `category` | ENUM('SALSA','VEGETAL','PROTEINA','QUESO','OTRO') | NOT NULL | Agrupación en UI |
| `is_active` | TINYINT(1) | DEFAULT 1 | |
| `inventory_item_id` | BIGINT FK → inventory_items.id | NULL | Vincula con inventario |

> **Regla de negocio crítica**: Los toppings son **predefinidos y solo se seleccionan**. No hay creación libre en el pedido. Esto garantiza consistencia de inventario.

#### `product_allowed_toppings` — Toppings permitidos por producto
| Campo | Tipo |
|-------|------|
| `product_id` | BIGINT FK → products.id |
| `topping_id` | BIGINT FK → toppings.id |
| PK: `(product_id, topping_id)` | |

> **Por qué esta tabla**: Cada producto tiene su propio universo de toppings válidos. Un cliente no debería poder poner salsa de ají en un postre. Esta relación N:M con restricción previene errores en la capa de dominio.

---

## Módulo 3 — Reglas de Toppings por Menú

### Entidad clave

#### `menu_topping_rules` — Reglas de selección de toppings por tipo de menú
| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | BIGINT UNSIGNED PK | |
| `menu_type` | ENUM('UNIVERSITARIO','ESPECIAL') | NOT NULL |
| `max_toppings` | TINYINT UNSIGNED | NULL — NULL = ilimitado |
| `allow_free_selection` | TINYINT(1) | DEFAULT 1 |
| `description` | VARCHAR(255) | NULL |

**Datos semilla**:
```sql
INSERT INTO menu_topping_rules VALUES
  (1, 'UNIVERSITARIO', 4,    1, 'Máximo 4 toppings seleccionables'),
  (2, 'ESPECIAL',      NULL, 1, 'Todos los toppings disponibles');
```

> **Justificación DDD**: Esta entidad encapsula las reglas de negocio del dominio como datos configurables, no como código hardcodeado. Si Ardientes cambia la política (ej. máx 6 universitario), se actualiza en DB sin despliegue.

---

## Módulo 4 — Clientes

#### `customers` — Clientes registrados
| Campo | Tipo | Restricción | Justificación |
|-------|------|-------------|---------------|
| `id` | BIGINT UNSIGNED PK | | |
| `full_name` | VARCHAR(120) | NOT NULL | |
| `phone` | VARCHAR(20) | UNIQUE NOT NULL | Identificador primario de fidelización |
| `email` | VARCHAR(120) | UNIQUE NULL | Opcional; canal de promociones |
| `address` | TEXT | NULL | Dirección principal de domicilio |
| `loyalty_points` | INT UNSIGNED | DEFAULT 0 | Sistema de puntos |
| `total_orders` | INT UNSIGNED | DEFAULT 0 | Desnormalizado para consultas rápidas |
| `total_spent` | DECIMAL(12,2) | DEFAULT 0.00 | Desnormalizado — KPI fidelización |
| `birth_date` | DATE | NULL | Promociones de cumpleaños |
| `is_active` | TINYINT(1) | DEFAULT 1 | |
| `created_at` | DATETIME | DEFAULT NOW() | |

> **Decisión de desnormalización**: `total_orders` y `total_spent` se actualizan con trigger o en la capa de aplicación al cerrar un pedido. Justificado porque las consultas de fidelización son frecuentes y los reportes deben ser rápidos. Se mantiene consistencia mediante transacciones.

---

## Módulo 5 — Promociones

#### `promotions` — Cabecera de promoción
| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | BIGINT UNSIGNED PK | |
| `name` | VARCHAR(120) | NOT NULL — ej. `2x1 Hamburguesas Martes` |
| `description` | TEXT | NULL |
| `discount_type` | ENUM('PORCENTAJE','MONTO_FIJO','2X1','COMBO_PRECIO') | NOT NULL |
| `discount_value` | DECIMAL(10,2) | NOT NULL — % o monto |
| `min_order_amount` | DECIMAL(10,2) | DEFAULT 0 |
| `applies_to` | ENUM('PRODUCTO','BEBIDA','PEDIDO','COMBO') | NOT NULL |
| `menu_type_restriction` | ENUM('UNIVERSITARIO','ESPECIAL','AMBOS') | DEFAULT 'AMBOS' |
| `topping_rule_override` | TINYINT(1) | DEFAULT 0 — ¿sobrescribe reglas de toppings? |
| `max_uses` | INT | NULL — NULL = ilimitado |
| `uses_count` | INT UNSIGNED | DEFAULT 0 |
| `valid_from` | DATETIME | NOT NULL |
| `valid_until` | DATETIME | NOT NULL |
| `is_active` | TINYINT(1) | DEFAULT 1 |
| `created_by` | BIGINT FK → users.id | NOT NULL |
| `created_at` | DATETIME | DEFAULT NOW() |

#### `promotion_products` — Productos incluidos en una promoción
| Campo | Tipo |
|-------|------|
| `promotion_id` | BIGINT FK → promotions.id |
| `product_id` | BIGINT FK → products.id |
| `quantity` | TINYINT | DEFAULT 1 |
| PK: `(promotion_id, product_id)` | |

#### `promotion_beverages` — Bebidas incluidas en una promoción
| Campo | Tipo |
|-------|------|
| `promotion_id` | BIGINT FK → promotions.id |
| `beverage_id` | BIGINT FK → beverages.id |
| `quantity` | TINYINT | DEFAULT 1 |
| PK: `(promotion_id, beverage_id)` | |

> **Justificación de tablas junction separadas**: Una promoción puede incluir 2 hamburguesas + 1 bebida. Al separar productos de bebidas en tablas distintas, cada entidad mantiene su integridad referencial y no se mezclan tipos incompatibles.

---

## Módulo 6 — Pedidos (Corazón del sistema)

#### `orders` — Cabecera de pedido
| Campo | Tipo | Restricción | Justificación |
|-------|------|-------------|---------------|
| `id` | BIGINT UNSIGNED PK | | |
| `order_number` | VARCHAR(20) | UNIQUE NOT NULL | Número legible: `ARD-2026-00001` |
| `customer_id` | BIGINT FK → customers.id | NULL | NULL = cliente anónimo |
| `user_id` | BIGINT FK → users.id | NOT NULL | Cajero que tomó el pedido |
| `order_type` | ENUM('MESA','RECOGER','DOMICILIO') | NOT NULL | Canal del pedido |
| `table_number` | VARCHAR(10) | NULL — solo si MESA | |
| `delivery_address` | TEXT | NULL — solo si DOMICILIO | |
| `delivery_user_id` | BIGINT FK → users.id | NULL — domiciliario | |
| `status` | ENUM('PENDIENTE','EN_PREPARACION','LISTO','ENTREGADO','CANCELADO') | DEFAULT 'PENDIENTE' | FSM del pedido |
| `menu_type` | ENUM('UNIVERSITARIO','ESPECIAL') | NOT NULL | Determina regla de toppings del pedido |
| `promotion_id` | BIGINT FK → promotions.id | NULL | Promoción aplicada |
| `subtotal` | DECIMAL(10,2) | NOT NULL | |
| `discount_amount` | DECIMAL(10,2) | DEFAULT 0.00 | |
| `total` | DECIMAL(10,2) | NOT NULL | |
| `notes` | TEXT | NULL | Notas especiales |
| `paid_at` | DATETIME | NULL | |
| `created_at` | DATETIME | DEFAULT NOW() | |
| `updated_at` | DATETIME | ON UPDATE NOW() | |

> **CHECK constraint** (aplicado en capa de dominio):
> - Si `order_type = 'MESA'` → `table_number` NOT NULL
> - Si `order_type = 'DOMICILIO'` → `delivery_address` NOT NULL, `customer_id` NOT NULL
> - Si `order_type = 'RECOGER'` → ningún campo extra requerido

#### `order_items` — Líneas de detalle del pedido
| Campo | Tipo | Restricción | Justificación |
|-------|------|-------------|---------------|
| `id` | BIGINT UNSIGNED PK | | |
| `order_id` | BIGINT FK → orders.id | NOT NULL CASCADE DELETE | |
| `product_id` | BIGINT FK → products.id | NOT NULL | |
| `quantity` | TINYINT UNSIGNED | DEFAULT 1 | |
| `unit_price` | DECIMAL(10,2) | NOT NULL | **Precio en el momento del pedido** (inmutable) |
| `toppings_extra_price` | DECIMAL(10,2) | DEFAULT 0.00 | Suma de precios extra de toppings |
| `line_total` | DECIMAL(10,2) | NOT NULL | `(unit_price + toppings_extra_price) * quantity` |
| `notes` | VARCHAR(255) | NULL | ej. "sin cebolla" |

> **Decisión crítica de `unit_price`**: Se guarda el precio al momento del pedido, no FK al catálogo. Si el precio del producto cambia mañana, los pedidos históricos mantienen su valor real. Esto es requisito contable.

#### `order_item_toppings` — Toppings elegidos por línea de pedido
| Campo | Tipo | Restricción | Justificación |
|-------|------|-------------|---------------|
| `id` | BIGINT UNSIGNED PK | | |
| `order_item_id` | BIGINT FK → order_items.id | NOT NULL CASCADE DELETE | |
| `topping_id` | BIGINT FK → toppings.id | NOT NULL | |
| `topping_name` | VARCHAR(80) | NOT NULL | **Desnormalizado** — mismo motivo que unit_price |
| `extra_price` | DECIMAL(10,2) | DEFAULT 0.00 | |

**Constraint de negocio (validado en Use Case)**:
```
COUNT(order_item_toppings WHERE order_item_id = ?)
  ≤ menu_topping_rules.max_toppings
    WHERE menu_type = orders.menu_type
```

#### `order_beverages` — Bebidas del pedido
| Campo | Tipo |
|-------|------|
| `id` | BIGINT UNSIGNED PK |
| `order_id` | BIGINT FK → orders.id |
| `beverage_id` | BIGINT FK → beverages.id |
| `quantity` | TINYINT UNSIGNED DEFAULT 1 |
| `unit_price` | DECIMAL(10,2) NOT NULL |
| `line_total` | DECIMAL(10,2) NOT NULL |

> **Separadas de order_items** porque las bebidas no tienen toppings y tienen lógica de inventario distinta.

#### `order_status_history` — Trazabilidad del FSM
| Campo | Tipo |
|-------|------|
| `id` | BIGINT UNSIGNED PK |
| `order_id` | BIGINT FK → orders.id |
| `from_status` | ENUM (mismo que orders.status) |
| `to_status` | ENUM (mismo que orders.status) |
| `changed_by` | BIGINT FK → users.id |
| `notes` | VARCHAR(255) |
| `created_at` | DATETIME DEFAULT NOW() |

> Permite auditar quién cambió el estado y cuándo. Clave para resolver disputas con clientes.

---

## Módulo 7 — Inventario

#### `inventory_items` — Ítems de inventario (materias primas)
| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | BIGINT UNSIGNED PK | |
| `name` | VARCHAR(120) | NOT NULL — ej. `Carne de res 100g`, `Pan hamburguesa` |
| `unit` | ENUM('GRAMO','UNIDAD','LITRO','MILILITRO','PORCION') | NOT NULL |
| `current_stock` | DECIMAL(12,3) | DEFAULT 0 |
| `min_stock` | DECIMAL(12,3) | NOT NULL | Umbral de alerta |
| `max_stock` | DECIMAL(12,3) | NULL | Umbral de sobrestock |
| `cost_per_unit` | DECIMAL(10,4) | NOT NULL | Costo de materia prima |
| `supplier` | VARCHAR(120) | NULL |
| `is_active` | TINYINT(1) | DEFAULT 1 |

#### `inventory_movements` — Entradas y salidas
| Campo | Tipo | Restricción | Justificación |
|-------|------|-------------|---------------|
| `id` | BIGINT UNSIGNED PK | | |
| `item_id` | BIGINT FK → inventory_items.id | NOT NULL | |
| `movement_type` | ENUM('ENTRADA','SALIDA','AJUSTE','MERMA') | NOT NULL | |
| `quantity` | DECIMAL(12,3) | NOT NULL | |
| `unit_cost` | DECIMAL(10,4) | NULL | Para entradas; calcula costo de stock |
| `reference_type` | ENUM('PEDIDO','COMPRA','MANUAL','AJUSTE') | NOT NULL | |
| `reference_id` | BIGINT | NULL | ID del pedido u orden de compra |
| `notes` | TEXT | NULL | |
| `performed_by` | BIGINT FK → users.id | NOT NULL | |
| `created_at` | DATETIME | DEFAULT NOW() | |

> **Patrón Event Sourcing light**: El stock actual de `inventory_items.current_stock` siempre puede recalcularse desde `inventory_movements`. El campo desnormalizado existe para consultas rápidas pero se recalibra periódicamente.

#### `product_inventory_recipe` — Receta: qué items consume cada producto
| Campo | Tipo |
|-------|------|
| `product_id` | BIGINT FK → products.id |
| `inventory_item_id` | BIGINT FK → inventory_items.id |
| `quantity_per_unit` | DECIMAL(10,4) NOT NULL |
| `unit` | ENUM (mismo que inventory_items.unit) |
| PK: `(product_id, inventory_item_id)` | |

> Cuando se confirma un pedido, el sistema descuenta automáticamente del inventario según la receta. Esto conecta el módulo de pedidos con inventario sin acoplamiento directo.

#### `inventory_alerts` — Alertas generadas automáticamente
| Campo | Tipo |
|-------|------|
| `id` | BIGINT UNSIGNED PK |
| `item_id` | BIGINT FK → inventory_items.id |
| `alert_type` | ENUM('STOCK_BAJO','SOBRESTOCK','SIN_STOCK') |
| `current_stock` | DECIMAL(12,3) — snapshot al momento |
| `threshold` | DECIMAL(12,3) |
| `is_resolved` | TINYINT(1) DEFAULT 0 |
| `resolved_by` | BIGINT FK → users.id NULL |
| `created_at` | DATETIME DEFAULT NOW() |
| `resolved_at` | DATETIME NULL |

---

## Módulo 8 — Fidelización

#### `loyalty_transactions` — Movimientos de puntos
| Campo | Tipo |
|-------|------|
| `id` | BIGINT UNSIGNED PK |
| `customer_id` | BIGINT FK → customers.id |
| `order_id` | BIGINT FK → orders.id NULL |
| `points_delta` | INT NOT NULL — positivo=ganancia, negativo=redención |
| `reason` | ENUM('COMPRA','CANJE','AJUSTE','CUMPLEAÑOS','BONO') |
| `notes` | VARCHAR(255) |
| `created_by` | BIGINT FK → users.id |
| `created_at` | DATETIME DEFAULT NOW() |

#### `loyalty_config` — Configuración del programa de puntos
| Campo | Tipo |
|-------|------|
| `id` | TINYINT PK — fila única |
| `points_per_peso` | DECIMAL(6,4) — puntos por cada $1 gastado |
| `min_points_redeem` | INT — mínimo para canjear |
| `points_value` | DECIMAL(6,4) — valor en $ de cada punto |
| `is_active` | TINYINT(1) |

---

## Relaciones Clave — Diagrama Simplificado

```
users ──────────────────────────── roles
  │                                  │
  │ (cajero)                         └── role_permissions ── permissions
  │
  ├── orders ──────────────────────── customers
  │     │                               │
  │     ├── order_items ──────────── products ─── categories
  │     │     │                         │
  │     │     └── order_item_toppings   └── product_allowed_toppings ── toppings
  │     │                                                                    │
  │     ├── order_beverages ──── beverages              inventory_items ────┘
  │     │                                                    │
  │     ├── order_status_history                    inventory_movements
  │     │                                           inventory_alerts
  │     └── promotions ─── promotion_products
  │             │          promotion_beverages
  │             └── menu_topping_rules (restricción por menu_type)
  │
  └── loyalty_transactions ── customers
```

---

## Índices Estratégicos

```sql
-- Pedidos activos por tipo (pantalla de cocina)
INDEX idx_orders_status_type ON orders(status, order_type);

-- Histórico de cliente
INDEX idx_orders_customer ON orders(customer_id, created_at DESC);

-- Inventario bajo mínimo
INDEX idx_inventory_stock ON inventory_items(current_stock, min_stock);

-- Alertas pendientes
INDEX idx_alerts_resolved ON inventory_alerts(is_resolved, created_at);

-- Toppings por producto
INDEX idx_prod_toppings ON product_allowed_toppings(product_id);

-- Promociones vigentes
INDEX idx_promos_active ON promotions(is_active, valid_from, valid_until);
```

---

## Flujo de Negocio — Toma de Pedido

```
1. Cajero selecciona menu_type (UNIVERSITARIO | ESPECIAL)
2. Sistema filtra products WHERE menu_type IN ('AMBOS', selected)
3. Cliente selecciona producto con toppings
4. Use Case: valida COUNT(toppings) ≤ menu_topping_rules.max_toppings
5. Se verifica stock en inventory_items via product_inventory_recipe
6. Si hay promoción activa → se aplica descuento
7. Se crea orders + order_items + order_item_toppings (transacción atómica)
8. Se descuenta inventario en inventory_movements (SALIDA)
9. Se genera inventory_alert si current_stock < min_stock
10. Se acreditan loyalty_points al customer_id
11. Cambios de estado → order_status_history
```

---

## Decisiones de Arquitectura — Justificaciones SOLID/DDD

| Decisión | Patrón | Razón |
|----------|--------|-------|
| Separar `beverages` de `products` | ISP | Interfaces y lógica distintas |
| `unit_price` en `order_items` | Value Object inmutable | Integridad histórica contable |
| `menu_topping_rules` como entidad | Open/Closed Principle | Cambiar reglas sin modificar código |
| `inventory_movements` append-only | Event Sourcing | Trazabilidad + recalculo |
| Desnormalización de `total_spent` | Performance consciente | Justificada + mantenida por lógica de app |
| FK a `users` en todos los eventos | Auditoría | Trazabilidad legal y operativa |
| `order_number` legible | UX + Ops | Comunicación con cocina y cliente |

---

## Open Questions para Ardientes

> [!IMPORTANT]
> Estas preguntas afectan decisiones de implementación. Necesitamos respuestas antes de generar código.

1. **Pagos**: ¿Se registra el método de pago (efectivo, tarjeta, transferencia)? ¿Habrá integración con TPV físico?
2. **Mesas**: ¿Las mesas tienen estados propios (ocupada/disponible)? ¿Múltiples pedidos por mesa?
3. **Toppings universitario**: ¿Los 4 toppings son cualquiera de los permitidos, o hay grupos predefinidos por producto?
4. **Cocina**: ¿Se necesita pantalla de cocina (KDS) con WebSockets en tiempo real?
5. **Multi-sucursal**: ¿Ardientes tiene o planea tener múltiples sedes?
6. **Domicilio**: ¿Hay zonas de cobertura con recargo? ¿Integración con repartidores externos?
7. **Impresión**: ¿Tickets físicos (impresora térmica)? ¿Formato específico?
8. **Moneda**: ¿Pesos colombianos únicamente? ¿Decimales necesarios?
9. **Promociones acumulables**: ¿Puede aplicarse más de una promoción al mismo pedido?
10. **Inventario inicial**: ¿Se maneja inventario de bebidas como unidades o también por ml?


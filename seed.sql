-- ==========================================
-- Ardientes POS — Semillas de Datos Iniciales (Seed v5.0)
-- Motor: MySQL 8.0+
-- Collation: utf8mb4_unicode_ci
-- Cambios v4.0 → v5.0 (Bloque 5 - Fase 1):
--   • Rol MESERO (id = 6) con permisos de pedidos, mesas y clientes
--   • Permisos de mesas (13..16) formalizados en el seed
--   • user_roles: sincronización idempotente desde users.role_id
-- ==========================================

SET FOREIGN_KEY_CHECKS = 0;

-- ─── 1. Roles ─────────────────────────────────────────────────────────────────
INSERT INTO `roles` (`id`, `name`, `description`) VALUES
  (1, 'ADMIN',        'Administrador general con acceso total al sistema'),
  (2, 'CAJERO',       'Personal de caja: toma pedidos, factura y cierra pagos'),
  (3, 'COCINA',       'Operadores del Kitchen Display System (KDS)'),
  (4, 'DOMICILIARIO', 'Repartidores asignados a entregas externas'),
  (5, 'SUPERVISOR',   'Supervisor de turno con permisos para anulaciones y ajustes de stock'),
  (6, 'MESERO',       'Personal de salón / mesero: toma pedidos y gestiona mesas')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `description` = VALUES(`description`);

-- ─── 2. Permisos ──────────────────────────────────────────────────────────────
INSERT INTO `permissions` (`id`, `code`, `description`) VALUES
  (1,  'orders:create',         'Crear nuevos pedidos desde caja'),
  (2,  'orders:update_status',  'Actualizar estado de pedidos (Cocina / Cajero)'),
  (3,  'orders:cancel',         'Cancelar o anular pedidos confirmados'),
  (4,  'catalog:manage',        'Administrar productos, bebidas y combos'),
  (5,  'inventory:read',        'Visualizar niveles de stock y alertas'),
  (6,  'inventory:adjust',      'Ingresar compras, mermas y ajustes manuales'),
  (7,  'config:write',          'Modificar configuraciones globales del negocio'),
  (8,  'customers:manage',      'Crear y buscar clientes para fidelización'),
  (9,  'payments:manage',       'Registrar y revertir pagos de pedidos'),
  (10, 'cash_session:open',     'Abrir turno / sesión de caja'),
  (11, 'cash_session:close',    'Cerrar turno y realizar arqueo de caja'),
  (12, 'reports:read',          'Consultar reportes de ventas e inventario'),
  (13, 'tables:read',           'Consultar estado de mesas'),
  (14, 'tables:orders',         'Crear y consultar pedidos de mesas'),
  (15, 'tables:request_bill',   'Solicitar cuenta de mesas'),
  (16, 'tables:transfer',       'Cambiar pedidos entre mesas'),
  (17, 'business_day:close',    'Cerrar la jornada operativa del día')
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`), `description` = VALUES(`description`);

-- ─── 3. Permisos del Rol ADMIN (id = 1) ───────────────────────────────────────
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) VALUES
  (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8),
  (1, 9), (1, 10), (1, 11), (1, 12), (1, 13), (1, 14), (1, 15), (1, 16), (1, 17);

-- ─── 4. Permisos del Rol CAJERO (id = 2) ─────────────────────────────────────
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) VALUES
  (2, 1),   -- orders:create
  (2, 2),   -- orders:update_status
  (2, 8),   -- customers:manage
  (2, 9),   -- payments:manage
  (2, 10),  -- cash_session:open
  (2, 11);  -- cash_session:close

-- ─── 5. Permisos del Rol COCINA (id = 3) ─────────────────────────────────────
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) VALUES
  (3, 2);   -- orders:update_status

-- ─── 6. Permisos del Rol MESERO (id = 6) ─────────────────────────────────────
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) VALUES
  (6, 1),   -- orders:create
  (6, 2),   -- orders:update_status
  (6, 8),   -- customers:manage
  (6, 13),  -- tables:read
  (6, 14),  -- tables:orders
  (6, 15),  -- tables:request_bill
  (6, 16);  -- tables:transfer

-- ─── 7. Permisos del Rol SUPERVISOR (id = 5) ─────────────────────────────────
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) VALUES
  (5, 1),   -- orders:create
  (5, 2),   -- orders:update_status
  (5, 3),   -- orders:cancel
  (5, 5),   -- inventory:read
  (5, 6),   -- inventory:adjust
  (5, 8),   -- customers:manage
  (5, 9),   -- payments:manage
  (5, 10),  -- cash_session:open
  (5, 11),  -- cash_session:close
  (5, 12);  -- reports:read

-- ─── 8. Usuario Inicial (Admin Semilla) ──────────────────────────────────────
-- password_hash: bcrypt de 'admin123' (CAMBIAR antes de producción)
INSERT INTO `users` (`id`, `role_id`, `username`, `email`, `password_hash`, `full_name`, `is_active`) VALUES
  (1, 1, 'admin', 'admin@ardientes.com',
   '$2b$10$wKxN5gW1B52Hn7aU8oA5/exy3c8uMh59uDsnQ3oW4q0P7FjE2Pfe.',
   'Administrador Inicial', 1)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

-- ─── 9. Asignación Multi-Rol Inicial (user_roles) ───────────────────────────
-- Migración idempotente de users.role_id hacia user_roles
INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`)
SELECT `id`, `role_id` FROM `users` WHERE `role_id` IS NOT NULL;

-- ─── 10. Reglas de Toppings por Menú ──────────────────────────────────────────
INSERT INTO `menu_topping_rules` (`id`, `menu_type`, `max_toppings`, `allow_free_selection`, `description`) VALUES
  (1, 'UNIVERSITARIO', 4,    1, 'Máximo 4 adiciones por producto. Restricción del menú estudiantil.'),
  (2, 'ESPECIAL',      NULL, 1, 'Sin límite de adiciones. Cada una se cobra individualmente.')
ON DUPLICATE KEY UPDATE `max_toppings` = VALUES(`max_toppings`), `description` = VALUES(`description`);

-- ─── 11. Configuración del Negocio (Singleton id = 1) ─────────────────────────
INSERT INTO `business_config` (
  `id`, `business_name`, `logo_url`, `address`, `phone`, `whatsapp`, `email`,
  `schedule`, `social_networks`, `ticket_message`,
  `tax_percentage`, `tax_included`, `delivery_base_cost`,
  `currency_symbol`, `currency_code`,
  `loyalty_active`, `promotions_active`,
  `points_per_peso`, `min_points_redeem`, `points_value`, `updated_by`
) VALUES (
  1,
  'Ardientes POS',
  'https://ardientespos.com/assets/logo.png',
  'Calle 45 # 23-12, Bogotá, Colombia',
  '+57 300 123 4567',
  '+57 300 765 4321',
  'contacto@ardientespos.com',
  '{
    "monday":    {"open": "11:00", "close": "22:00", "is_open": true},
    "tuesday":   {"open": "11:00", "close": "22:00", "is_open": true},
    "wednesday": {"open": "11:00", "close": "22:00", "is_open": true},
    "thursday":  {"open": "11:00", "close": "22:00", "is_open": true},
    "friday":    {"open": "11:00", "close": "23:00", "is_open": true},
    "saturday":  {"open": "11:00", "close": "23:00", "is_open": true},
    "sunday":    {"open": "11:00", "close": "21:00", "is_open": true}
  }',
  '{
    "instagram": "@ardientes.pos",
    "facebook":  "fb.com/ardientes.pos",
    "tiktok":    "@ardientes.pos"
  }',
  '¡Gracias por preferir Ardientes! Disfruta tu comida.',
  8.00,      -- 8% Impuesto al Consumo (Colombia)
  1,         -- Impuesto incluido en precios
  4000.00,   -- Costo base de domicilio
  '$',
  'COP',
  1,         -- Fidelización activa
  1,         -- Promociones activas
  0.0500,    -- 0.05 puntos por $1 gastado (ej: $10.000 → 500 puntos)
  1000,      -- Mínimo 1000 puntos para redimir
  1.0000,    -- Cada punto equivale a $1 COP
  1
) ON DUPLICATE KEY UPDATE `business_name` = VALUES(`business_name`), `tax_percentage` = VALUES(`tax_percentage`);

-- ─── 12. Categorías de Menú ────────────────────────────────────────────────────
INSERT INTO `categories` (`id`, `name`, `icon_url`, `sort_order`, `is_active`) VALUES
  (1, 'Hamburguesas',           'hamburger-icon.png', 1, 1),
  (2, 'Perros Calientes',       'hotdog-icon.png',    2, 1),
  (3, 'Salchipapas',            'fries-icon.png',     3, 1),
  (4, 'Mazorcadas',             'corn-icon.png',      4, 1),
  (5, 'Plátanos',               'banana-icon.png',    5, 1),
  (6, 'Portolocos',             'dorito-icon.png',    6, 1),
  (7, 'Combo Mini Hamburguesas','mini-hamb-icon.png', 7, 1),
  (8, 'Bebidas',                'beverage-icon.png',  8, 1),
  (9, 'Patacón',                'patacon-icon.png',   9, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `sort_order` = VALUES(`sort_order`), `is_active` = VALUES(`is_active`);

-- ─── 13. Catálogo de Productos (58 Productos - MENÚ UNIVERSITARIO + MENÚ ESPECIAL) ─────────────
INSERT INTO `products` (
  `id`, `category_id`, `sku`, `name`, `description`,
  `price_universitario`, `price_especial`, `image_url`, `has_toppings`, `available_in`, `is_active`
) VALUES
  -- =========================================================================
  -- MENÚ UNIVERSITARIO (IDs 1 - 33)
  -- =========================================================================
  -- Hamburguesas (cat 1 - MENÚ UNIVERSITARIO)
  (1, 1, 'HAMB-DESN-001', 'Desnudita', 'Pan brioche + carne artesanal + toppings', 7000.00, NULL, 'desnudita.jpg', 1, 'UNIVERSITARIO', 1),
  (2, 1, 'HAMB-TENT-002', 'Tentadora', 'Pan brioche + carne artesanal + toppings + queso cheddar', 8000.00, NULL, 'tentadora.jpg', 1, 'UNIVERSITARIO', 1),
  (3, 1, 'HAMB-PECA-003', 'Pecadora', 'Pan brioche + carne artesanal + toppings + doble queso + huevo frito', 10000.00, NULL, 'pecadora-hamb.jpg', 1, 'UNIVERSITARIO', 1),
  (4, 1, 'HAMB-GOLO-004', 'Golosa', 'Pan brioche + carne artesanal + toppings + doble queso + tocineta', 10000.00, NULL, 'golosa.jpg', 1, 'UNIVERSITARIO', 1),
  (5, 1, 'HAMB-JUGU-005', 'Juguetona', 'Pan brioche + carne artesanal + toppings + queso + carne desmechada + pollo desmechado', 12000.00, NULL, 'juguetona.jpg', 1, 'UNIVERSITARIO', 1),
  (6, 1, 'HAMB-CARG-006', 'Cargadita', 'Pan brioche + carne artesanal + toppings + doble queso + chorizo santarrosano + chimichurri + huevo frito + tocineta', 12000.00, NULL, 'cargadita.jpg', 1, 'UNIVERSITARIO', 1),
  (7, 1, 'HAMB-ARDI-007', 'Ardiente Especial', 'Pan brioche + carne artesanal + toppings + doble queso + chorizo santarrosano + chimichurri + tocineta + costilla gratinada', 15000.00, NULL, 'ardiente-especial.jpg', 1, 'UNIVERSITARIO', 1),

  -- Perros Calientes (cat 2)
  (8, 2, 'PDOG-DESN-001', 'Desnudito', 'Pan + salchicha americana', 7000.00, NULL, 'desnudito.jpg', 1, 'UNIVERSITARIO', 1),
  (9, 2, 'PDOG-TRAV-002', 'Travieso', 'Pan + salchicha americana + queso', 8000.00, NULL, 'travieso-pdog.jpg', 1, 'UNIVERSITARIO', 1),
  (10, 2, 'PDOG-JUGU-003', 'Juguetón', 'Pan + salchicha americana + queso + tocineta', 10000.00, NULL, 'jugueton-pdog.jpg', 1, 'UNIVERSITARIO', 1),
  (11, 2, 'PDOG-MORD-004', 'Mordelón', 'Pan + salchicha americana + queso + tocineta + carne', 15000.00, NULL, 'mordelon.jpg', 1, 'UNIVERSITARIO', 1),

  -- Salchipapas (cat 3)
  (12, 3, 'SALC-ROMP-001', 'Rompe Dieta', 'Papitas a la francesa + chorizo + queso + toppings', 10000.00, NULL, 'rompedieta.jpg', 1, 'UNIVERSITARIO', 1),
  (13, 3, 'SALC-DOBL-002', 'Doble Placer', 'Papitas a la francesa + carne desmechada + chorizo + queso + toppings', 15000.00, NULL, 'dobleplacer.jpg', 1, 'UNIVERSITARIO', 1),
  (14, 3, 'SALC-PECA-003', 'Pecadora', 'Papitas a la francesa + carne desmechada + chorizo + queso + pollo desmechado + toppings', 20000.00, NULL, 'pecadora-salc.jpg', 1, 'UNIVERSITARIO', 1),
  (15, 3, 'SALC-POTE-004', 'Potente', 'Papitas a la francesa + pollo desmechado + chorizo + queso + carne desmechada + tocineta + costilla gratinada + toppings', 25000.00, NULL, 'potente.jpg', 1, 'UNIVERSITARIO', 1),

  -- Mazorcadas (cat 4)
  (16, 4, 'MAZO-SUAV-001', 'La Suavecita', 'Mazorca tierna + queso fundido + carne desmechada + toppings a elección', 12000.00, NULL, 'suavecita.jpg', 1, 'UNIVERSITARIO', 1),
  (17, 4, 'MAZO-JUGO-002', 'La Jugosa', 'Mazorca + queso + carne desmechada + pollo desmechado + toppings', 15000.00, NULL, 'jugosa.jpg', 1, 'UNIVERSITARIO', 1),
  (18, 4, 'MAZO-CROC-003', 'La Crocantica', 'Plátano maduro + chorizo + queso fundido + carne desmechada o pollo desmechado + tocineta', 15000.00, NULL, 'crocantica.jpg', 1, 'UNIVERSITARIO', 1),
  (19, 4, 'MAZO-PECA-004', 'La Pecadora', 'Mazorca + queso + carne + pollo + tocineta + chorizo picado + toppings', 20000.00, NULL, 'pecadora-mazo.jpg', 1, 'UNIVERSITARIO', 1),
  (20, 4, 'MAZO-SALV-005', 'La Salvaje', 'Mazorca + queso + carne + pollo + tocineta + chorizo + costilla ahumada + toppings', 25000.00, NULL, 'salvaje.jpg', 1, 'UNIVERSITARIO', 1),

  -- Plátanos (cat 5)
  (21, 5, 'PLAT-SUAV-001', 'El Suavecito', 'Plátano maduro + chorizo + queso fundido', 9000.00, NULL, 'suavecito-plat.jpg', 1, 'UNIVERSITARIO', 1),
  (22, 5, 'PLAT-CALE-002', 'El Calentón', 'Plátano maduro + salchicha + queso fundido + tocineta crocante', 11000.00, NULL, 'calenton.jpg', 1, 'UNIVERSITARIO', 1),
  (23, 5, 'PLAT-TRAV-003', 'El Travieso', 'Plátano maduro + chorizo + queso fundido + carne desmechada o pollo desmechado + tocineta', 15000.00, NULL, 'travieso-plat.jpg', 1, 'UNIVERSITARIO', 1),
  (24, 5, 'PLAT-PECA-004', 'El Pecador', 'Plátano maduro + chorizo + queso fundido + carne y pollo desmechados + tocineta', 20000.00, NULL, 'pecador-plat.jpg', 1, 'UNIVERSITARIO', 1),
  (25, 5, 'PLAT-HARD-005', 'El Hardcore', 'Plátano maduro + chorizo + queso fundido + carne + pollo + tocineta + costilla ahumada', 25000.00, NULL, 'hardcore.jpg', 1, 'UNIVERSITARIO', 1),

  -- Portolocos (cat 6)
  (26, 6, 'PORT-TRAV-001', 'El Travieso', 'Doritos + queso fundido + carne desmechada + toppings a elección', 12000.00, NULL, 'travieso-port.jpg', 1, 'UNIVERSITARIO', 1),
  (27, 6, 'PORT-TOCO-002', 'El Tocón', 'Doritos + queso + carne desmechada + pollo desmechado + toppings', 15000.00, NULL, 'tocon.jpg', 1, 'UNIVERSITARIO', 1),
  (28, 6, 'PORT-GRIT-003', 'El Gritón', 'Doritos + queso + carne + pollo + tocineta crocante + toppings', 27000.00, NULL, 'griton.jpg', 1, 'UNIVERSITARIO', 1),
  (29, 6, 'PORT-ENCE-004', 'El Encendido', 'Doritos + queso + carne + pollo + tocineta + chorizo picado + toppings', 20000.00, NULL, 'encendido.jpg', 1, 'UNIVERSITARIO', 1),

  -- Combo Mini Hamburguesas (cat 7)
  (30, 7, 'MINI-10HA-001', '10 Hamburguesas Mini', 'Pan + carne + toppings', 40000.00, NULL, 'mini10.jpg', 1, 'UNIVERSITARIO', 1),
  (31, 7, 'MINI-10HQ-002', '10 Hamburguesas Mini con Queso', 'Pan + carne + queso + toppings', 50000.00, NULL, 'mini10q.jpg', 1, 'UNIVERSITARIO', 1),
  (32, 7, 'MINI-20HA-003', '20 Hamburguesas Mini', 'Pan + carne + toppings', 75000.00, NULL, 'mini20.jpg', 1, 'UNIVERSITARIO', 1),
  (33, 7, 'MINI-20HQ-004', '20 Hamburguesas Mini con Queso', 'Pan + carne + queso + toppings', 95000.00, NULL, 'mini20q.jpg', 1, 'UNIVERSITARIO', 1),

  -- =========================================================================
  -- MENÚ ESPECIAL (IDs 34 - 58)
  -- =========================================================================
  -- Perros Calientes (cat 2) — Incluye Porción de Papas
  (34, 2, 'PDOG-ESP-DESN-001', 'Desnudito', 'Salchicha americana o chorizo artesanal, delicioso queso fundido cremoso combinado con suave maíz tierno. Incluye porción de papas.', NULL, 16000.00, 'desnudito-esp.jpg', 1, 'ESPECIAL', 1),
  (35, 2, 'PDOG-ESP-TENT-002', 'Tentador', 'Salchicha americana o chorizo artesanal, delicioso queso fundido cremoso combinado con suave maíz tierno, tocineta caramelizada. Incluye porción de papas.', NULL, 18000.00, 'tentador-pdog.jpg', 1, 'ESPECIAL', 1),
  (36, 2, 'PDOG-ESP-AFRO-003', 'Afrodisiaco', 'Salchicha americana o chorizo artesanal, carne desmechada, delicioso queso fundido cremoso combinado con suave maíz tierno, deliciosa combinación de tocineta y costilla caramelizada. Incluye porción de papas.', NULL, 22000.00, 'afrodisiaco-pdog.jpg', 1, 'ESPECIAL', 1),
  (37, 2, 'PDOG-ESP-ARDI-004', 'Ardiente', 'Salchicha americana o chorizo artesanal, carne desmechada, pollo en salsa de champiñones, delicioso queso fundido cremoso combinado con suave maíz tierno, queso rallado, deliciosa combinación de tocineta y costilla caramelizada. Incluye porción de papas.', NULL, 25000.00, 'ardiente-pdog.jpg', 1, 'ESPECIAL', 1),

  -- Plátanos (cat 5) — Incluye Bebida Personal
  (38, 5, 'PLAT-ESP-DESN-001', 'Desnudito', 'Rodajas de platanitos caramelizados, delicioso queso fundido cremoso combinado con suave maíz tierno. Incluye bebida personal.', NULL, 18000.00, 'desnudito-plat.jpg', 1, 'ESPECIAL', 1),
  (39, 5, 'PLAT-ESP-TENT-002', 'Tentador', 'Rodajas de platanitos caramelizados, delicioso queso fundido cremoso combinado con suave maíz tierno, carne desmechada, tocineta caramelizada. Incluye bebida personal.', NULL, 22000.00, 'tentador-plat.jpg', 1, 'ESPECIAL', 1),
  (40, 5, 'PLAT-ESP-AFRO-003', 'Afrodisiaco', 'Rodajas de platanitos caramelizados, delicioso queso fundido cremoso combinado con suave maíz tierno, carne desmechada, tocineta caramelizada, carne desmechada, chorizo. Incluye bebida personal.', NULL, 26000.00, 'afrodisiaco-plat.jpg', 1, 'ESPECIAL', 1),
  (41, 5, 'PLAT-ESP-ARDI-004', 'Ardiente', 'Rodajas de platanitos caramelizados, delicioso queso fundido cremoso combinado con suave maíz tierno, carne desmechada, tocineta caramelizada, carne desmechada, pollo en salsa de champiñones y chorizo. Incluye bebida personal.', NULL, 30000.00, 'ardiente-plat.jpg', 1, 'ESPECIAL', 1),

  -- Patacón (cat 9) — Incluye Bebida Personal
  (42, 9, 'PATA-ESP-DESN-001', 'Desnudito', 'Patacón maduro con base de chimichurri, delicioso queso fundido cremoso combinado con suave maíz tierno. Incluye bebida personal.', NULL, 18000.00, 'desnudito-pata.jpg', 1, 'ESPECIAL', 1),
  (43, 9, 'PATA-ESP-TENT-002', 'Tentador', 'Patacón maduro con base de chimichurri, delicioso queso fundido cremoso combinado con suave maíz tierno, carne desmechada, tocineta caramelizada. Incluye bebida personal.', NULL, 21000.00, 'tentador-pata.jpg', 1, 'ESPECIAL', 1),
  (44, 9, 'PATA-ESP-AFRO-003', 'Afrodisiaco', 'Patacón maduro con base de chimichurri, delicioso queso fundido cremoso combinado con suave maíz tierno, carne desmechada, tocineta caramelizada, carne desmechada, chorizo. Incluye bebida personal.', NULL, 24000.00, 'afrodisiaco-pata.jpg', 1, 'ESPECIAL', 1),
  (45, 9, 'PATA-ESP-ARDI-004', 'Ardiente', 'Patacón maduro con base de chimichurri, delicioso queso fundido cremoso combinado con suave maíz tierno, carne desmechada, tocineta caramelizada, carne desmechada, pollo en salsa de champiñones y chorizo. Incluye bebida personal.', NULL, 30000.00, 'ardiente-pata.jpg', 1, 'ESPECIAL', 1),

  -- Salchipapas (cat 3) — Incluye Bebida Personal
  (46, 3, 'SALC-ESP-ROMP-001', 'Rompe Dieta', 'Papa frita, salchicha o chorizo, delicioso queso gratinado, tocineta (Personal). Incluye bebida personal.', NULL, 20000.00, 'rompedieta-esp.jpg', 1, 'ESPECIAL', 1),
  (47, 3, 'SALC-ESP-DOBL-002', 'Doble Placer', 'Papa frita, salchicha o chorizo, delicioso queso gratinado, tocineta y carne desmechada (Personal). Incluye bebida personal.', NULL, 22000.00, 'dobleplacer-esp.jpg', 1, 'ESPECIAL', 1),
  (48, 3, 'SALC-ESP-PECA-003', 'Pecadora', 'Papa frita, salchicha o chorizo, delicioso queso gratinado, tocineta y carne desmechada, pollo en salsa de champiñones (Personal). Incluye bebida personal.', NULL, 26000.00, 'pecadora-esp.jpg', 1, 'ESPECIAL', 1),
  (49, 3, 'SALC-ESP-POTE-004', 'Potente', 'Papa frita, salchicha o chorizo, delicioso queso gratinado, tocineta y carne desmechada, pollo en salsa de champiñones (Personal). Incluye bebida personal.', NULL, 28000.00, 'potente-esp.jpg', 1, 'ESPECIAL', 1),
  (50, 3, 'SALC-ESP-ARDI-005', 'Ardiente', 'Papa frita, salchicha o chorizo, delicioso queso gratinado, tocineta y carne desmechada, pollo en salsa de champiñones y costilla caramelizada (Para dos). Incluye bebida personal.', NULL, 35000.00, 'ardiente-salc.jpg', 1, 'ESPECIAL', 1),

  -- Dorilocos / Portolocos (cat 6) — Incluye Bebida Personal
  (51, 6, 'PORT-ESP-DESN-001', 'Desnudito', 'Doritos, delicioso queso fundido cremoso combinado con suave maíz tierno. Incluye bebida personal.', NULL, 18000.00, 'desnudito-dori.jpg', 1, 'ESPECIAL', 1),
  (52, 6, 'PORT-ESP-TENT-002', 'Tentador', 'Doritos, delicioso queso fundido cremoso combinado con suave maíz tierno, carne desmechada, tocineta caramelizada. Incluye bebida personal.', NULL, 23000.00, 'tentador-dori.jpg', 1, 'ESPECIAL', 1),
  (53, 6, 'PORT-ESP-AFRO-003', 'Afrodisiaco', 'Doritos, delicioso queso fundido cremoso combinado con suave maíz tierno, carne desmechada, tocineta caramelizada, carne desmechada, chorizo. Incluye bebida personal.', NULL, 25000.00, 'afrodisiaco-dori.jpg', 1, 'ESPECIAL', 1),
  (54, 6, 'PORT-ESP-ARDI-004', 'Ardiente', 'Doritos, delicioso queso fundido cremoso combinado con suave maíz tierno, carne desmechada, tocineta caramelizada, carne desmechada, pollo en salsa de champiñones y chorizo. Incluye bebida personal.', NULL, 30000.00, 'ardiente-dori.jpg', 1, 'ESPECIAL', 1),

  -- Combo Mini Hamburguesas (cat 7) — Incluye Porción de Papitas
  (55, 7, 'MINI-ESP-DESN-001', 'Desnuditas', '4 hamburguesas minis, queso fundido, porción de papitas.', NULL, 28000.00, 'desnuditas-mini.jpg', 1, 'ESPECIAL', 1),
  (56, 7, 'MINI-ESP-AFRO-002', 'Afrodisiaca', '6 hamburguesas minis, queso fundido, porción de papitas.', NULL, 35000.00, 'afrodisiaca-mini.jpg', 1, 'ESPECIAL', 1),
  (57, 7, 'MINI-ESP-ARD10-003', 'Ardiente - 10 Mini Burgers', '10 hamburguesas minis, queso fundido, porción de papitas.', NULL, 60000.00, 'ardiente10-mini.jpg', 1, 'ESPECIAL', 1),
  (58, 7, 'MINI-ESP-ARD20-004', 'Ardiente - 20 Mini Burgers', '20 hamburguesas minis, queso fundido, porción de papitas.', NULL, 110000.00, 'ardiente20-mini.jpg', 1, 'ESPECIAL', 1),

  -- =========================================================================
  -- Hamburguesas (cat 1) — MENÚ ESPECIAL (IDs 59 - 64)
  -- Todas incluyen porción de papa y tienen toppings ilimitados.
  -- =========================================================================
  (59, 1, 'HAMB-ESP-DESN-001', 'Desnudita', 'Carne de res, queso cheddar, toppings ilimitados. Incluye porción de papa.', NULL, 15000.00, 'desnudita-esp.jpg', 1, 'ESPECIAL', 1),
  (60, 1, 'HAMB-ESP-DOBL-002', 'Doble Placer', 'Carne de res x2, tocineta, queso cheddar, toppings ilimitados. Incluye porción de papa.', NULL, 17000.00, 'dobleplacer-hamb-esp.jpg', 1, 'ESPECIAL', 1),
  (61, 1, 'HAMB-ESP-TENT-003', 'Tentadora', 'Carne de res, queso cheddar, tocineta y toppings ilimitados. Incluye porción de papa.', NULL, 17000.00, 'tentadora-esp.jpg', 1, 'ESPECIAL', 1),
  (62, 1, 'HAMB-ESP-AFRO-004', 'Afrodisiaca', 'Carne de res, carne desmechada, mermelada de tocineta y costilla, queso cheddar y toppings ilimitados. Incluye porción de papa.', NULL, 20000.00, 'afrodisiaca-hamb-esp.jpg', 1, 'ESPECIAL', 1),
  (63, 1, 'HAMB-ESP-ARDI-005', 'Ardiente', 'Carne de res, carne desmechada, tocineta caramelizada, chorizo bañado en chimichurri, queso cheddar y toppings ilimitados. Incluye porción de papa.', NULL, 22000.00, 'ardiente-hamb-esp.jpg', 1, 'ESPECIAL', 1),
  (64, 1, 'HAMB-ESP-AESP-006', 'Ardiente Especial', 'Carne de res, carne desmechada, tocineta caramelizada, chorizo bañado en chimichurri, queso cheddar y toppings ilimitados, además de queso fundido cremoso combinado con suave maíz tierno. Incluye porción de papa.', NULL, 25000.00, 'ardiente-especial-esp.jpg', 1, 'ESPECIAL', 1)
ON DUPLICATE KEY UPDATE
  `category_id`         = VALUES(`category_id`),
  `name`                = VALUES(`name`),
  `description`         = VALUES(`description`),
  `price_universitario` = VALUES(`price_universitario`),
  `price_especial`      = VALUES(`price_especial`),
  `has_toppings`        = VALUES(`has_toppings`),
  `available_in`        = VALUES(`available_in`),
  `is_active`           = VALUES(`is_active`);

-- ─── 11. Bebidas (category_id = 8) ───────────────────────────────────────────
INSERT INTO `beverages` (`id`, `category_id`, `sku`, `name`, `size`, `price`, `stock_qty`, `is_active`) VALUES
  (1, 8, 'BEV-COLA-350', 'Coca Cola Regular 350ml', 'MEDIANO', 3500.00, 120, 1),
  (2, 8, 'BEV-COLA-ZER', 'Coca Cola Zero 350ml',    'MEDIANO', 3500.00, 80,  1),
  (3, 8, 'BEV-WATE-300', 'Agua Mineral sin Gas 300ml','PEQUEÑO',2500.00, 60,  1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `price` = VALUES(`price`), `category_id` = VALUES(`category_id`);

-- ─── 12. Materia Prima (Inventario Físico) ────────────────────────────────────
INSERT INTO `inventory_items` (`id`, `name`, `unit`, `current_stock`, `min_stock`, `cost_per_unit`) VALUES
  (1, 'Pan de Hamburguesa con Ajonjolí', 'UNIDAD',  500.000, 50.000,  800.0000),
  (2, 'Carne de Res Molida 150g',        'UNIDAD',  400.000, 30.000,  3500.0000),
  (3, 'Lonja de Queso Cheddar 20g',      'UNIDAD',  800.000, 60.000,  500.0000),
  (4, 'Salsa Especial Ardientes',        'GRAMO',   5000.000,500.000, 15.0000),
  (5, 'Tomate Fresco en Rodajas',        'UNIDAD',  150.000, 15.000,  300.0000),
  (6, 'Tocino Crujiente 15g',            'PORCION', 300.000, 20.000,  1200.0000),
  (7, 'Jalapeño Rodajas 10g',            'PORCION', 200.000, 15.000,  600.0000)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `current_stock` = VALUES(`current_stock`);

-- ─── 13. Toppings disponibles (TODOS GRATIS $0 en Menú Universitario) ──────────
INSERT INTO `toppings` (`id`, `name`, `extra_price`, `category`, `is_active`) VALUES
  (1,  'Cebolla caramelizada',                   0.00, 'VEGETAL', 1),
  (2,  'Pico de gallo',                          0.00, 'VEGETAL', 1),
  (3,  'Guacamole',                              0.00, 'VEGETAL', 1),
  (4,  'Jalapeños',                              0.00, 'VEGETAL', 1),
  (5,  'Papitas chips',                          0.00, 'OTRO',    1),
  (6,  'Nachos',                                 0.00, 'OTRO',    1),
  (7,  'Maíz tierno',                            0.00, 'VEGETAL', 1),
  (8,  'Maduros',                                0.00, 'VEGETAL', 1),
  (9,  'Tomate',                                 0.00, 'VEGETAL', 1),
  (10, 'Piña',                                   0.00, 'VEGETAL', 1),
  (11, 'Lluvia de queso gratinado',              0.00, 'QUESO',   1),
  (12, 'Combo Universitario (Papas + Gaseosa)', 5000.00, 'OTRO',    1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `extra_price` = VALUES(`extra_price`), `category` = VALUES(`category`), `is_active` = VALUES(`is_active`);

-- ─── 14. Toppings permitidos por producto ─────────────────────────────────────
INSERT IGNORE INTO `product_allowed_toppings` (`product_id`, `topping_id`)
SELECT p.id, t.id FROM `products` p CROSS JOIN `toppings` t;

-- ─── 15. Combo semilla ────────────────────────────────────────────────────────
INSERT INTO `combos` (`id`, `name`, `description`, `price`, `is_active`, `created_by`) VALUES
  (1, 'Combo Ardientes Universitario',
   'Perro Universitario + Porción de Papas Fritas + Gaseosa Regular 350ml.',
   14000.00, 1, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `price` = VALUES(`price`);

-- Productos incluidos en el combo
INSERT IGNORE INTO `combo_products` (`combo_id`, `product_id`, `quantity`, `menu_type`) VALUES
  (1, 3, 1, 'UNIVERSITARIO'),  -- Perro Universitario
  (1, 4, 1, 'UNIVERSITARIO'); -- Papas Fritas (ajustado: menú universitario)

-- Bebidas incluidas en el combo
INSERT IGNORE INTO `combo_beverages` (`combo_id`, `beverage_id`, `quantity`) VALUES
  (1, 1, 1);  -- Coca Cola Regular 350ml

-- ─── 16. Receta semilla (Hamburguesa Especial) ────────────────────────────────
INSERT INTO `recipes` (`id`, `product_id`, `name`, `notes`, `is_active`) VALUES
  (1, 1, 'Receta Hamburguesa Especial',
   'Armar sobre pan brioche caliente. Tostar un lado, poner carne, queso y 1 rodaja de tomate.', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT IGNORE INTO `recipe_ingredients` (`recipe_id`, `inventory_item_id`, `quantity`, `unit`) VALUES
  (1, 1, 1.0000, 'UNIDAD'),   -- Pan
  (1, 2, 1.0000, 'UNIDAD'),   -- Carne
  (1, 3, 1.0000, 'UNIDAD'),   -- Queso Cheddar
  (1, 4, 15.0000,'GRAMO'),    -- Salsa Especial
  (1, 5, 1.0000, 'UNIDAD');   -- Tomate

-- ─── 17. Zona y Mesa semilla ─────────────────────────────────────────────────
INSERT INTO `zones` (`id`, `name`) VALUES
  (1, 'Salón Principal'),
  (2, 'Terraza')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `tables` (`id`, `zone_id`, `table_number`, `capacity`, `status`) VALUES
  (1, 1, 'M-01', 4, 'AVAILABLE'),
  (2, 1, 'M-02', 4, 'AVAILABLE'),
  (3, 1, 'M-03', 6, 'AVAILABLE'),
  (4, 2, 'T-01', 4, 'AVAILABLE'),
  (5, 2, 'T-02', 4, 'AVAILABLE')
ON DUPLICATE KEY UPDATE `capacity` = VALUES(`capacity`), `status` = VALUES(`status`);

-- ─── 18. Métodos de Pago semilla ──────────────────────────────────────────────
-- NUEVO v4.0: incluye type y requires_reference para el módulo de caja.
-- type CASH  → cuenta como dinero físico en el arqueo
-- type DIGITAL / CARD → solo se cuantifican por valor, no como efectivo físico
INSERT INTO `payment_methods` (`id`, `name`, `type`, `requires_reference`, `sort_order`, `is_active`) VALUES
  (1, 'Efectivo',          'CASH',    0, 1, 1),
  (2, 'Tarjeta Débito',    'CARD',    0, 2, 1),
  (3, 'Tarjeta Crédito',   'CARD',    0, 3, 1),
  (4, 'Nequi',             'DIGITAL', 1, 4, 1),  -- Requiere número de referencia
  (5, 'Daviplata',         'DIGITAL', 1, 5, 1),  -- Requiere número de referencia
  (6, 'Transferencia PSE', 'DIGITAL', 1, 6, 1)   -- Requiere número de referencia
ON DUPLICATE KEY UPDATE
  `name`               = VALUES(`name`),
  `type`               = VALUES(`type`),
  `requires_reference` = VALUES(`requires_reference`),
  `sort_order`         = VALUES(`sort_order`);

-- ─── 19. Caja Registradora semilla ───────────────────────────────────────────
-- NUEVO v4.0: necesario para poder abrir sesiones de caja.
INSERT INTO `cash_registers` (`id`, `name`, `is_active`) VALUES
  (1, 'Caja Principal', 1),
  (2, 'Caja Secundaria', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ─── 20. Cliente semilla para pruebas de fidelización ────────────────────────
INSERT INTO `customers` (`id`, `full_name`, `phone`, `email`, `address`, `loyalty_points`) VALUES
  (1, 'Juan Pérez Estudiante', '3009998877',
   'juan.perez@universidad.edu.co',
   'Calle 100 # 15-45, Apto 402', 1500)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`), `loyalty_points` = VALUES(`loyalty_points`);

SET FOREIGN_KEY_CHECKS = 1;

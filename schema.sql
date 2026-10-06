-- ==========================================
-- Ardientes POS — Esquema de Base de Datos (v5.0)
-- Motor: MySQL 8.0+
-- Collation: utf8mb4_unicode_ci
-- Cambios v4.0 → v5.0 (Bloque 5 - Fase 1):
--   • user_roles: +tabla asociativa (user_id, role_id) para soporte multi-rol
--   • users.role_id: conservado temporalmente para retrocompatibilidad
-- ==========================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------
-- Módulo 1: Identidad y Control de Acceso (IAM)
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS `roles` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(50)  NOT NULL UNIQUE,
  `description` VARCHAR(255) NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permissions` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `code`        VARCHAR(80)  NOT NULL UNIQUE,
  `description` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id`       BIGINT UNSIGNED NOT NULL,
  `permission_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  CONSTRAINT `fk_role_permissions_role`       FOREIGN KEY (`role_id`)       REFERENCES `roles`       (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `role_id`       BIGINT UNSIGNED  NOT NULL,
  `username`      VARCHAR(60)      NOT NULL UNIQUE,
  `email`         VARCHAR(120)     NOT NULL UNIQUE,
  `password_hash` VARCHAR(255)     NOT NULL,
  `full_name`     VARCHAR(120)     NOT NULL,
  `is_active`     TINYINT(1)       NOT NULL DEFAULT 1,
  `last_login_at` DATETIME         NULL,
  `created_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_users_role` ON `users` (`role_id`);

-- Soporte Multi-Rol (Bloque 5)
CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id`    BIGINT UNSIGNED NOT NULL,
  `role_id`    BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `role_id`),
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_user_roles_role` ON `user_roles` (`role_id`);

-- ------------------------------------------
-- Módulo 2: Catálogo de Productos y Bebidas
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS `categories` (
  `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(80)  NOT NULL UNIQUE,
  `icon_url`   VARCHAR(255) NULL,
  `sort_order` SMALLINT     NOT NULL DEFAULT 0,
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índice para construir el catálogo POS dinámicamente (ordenado y filtrado por activo)
CREATE INDEX `idx_categories_active_sort` ON `categories` (`is_active`, `sort_order`);

CREATE TABLE IF NOT EXISTS `products` (
  `id`                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `category_id`          BIGINT UNSIGNED NOT NULL,
  `sku`                  VARCHAR(30)     NOT NULL UNIQUE,
  `name`                 VARCHAR(120)    NOT NULL,
  `description`          TEXT            NULL,
  `price_universitario`  DECIMAL(10,2)   NULL,
  `price_especial`       DECIMAL(10,2)   NULL,
  `image_url`            VARCHAR(255)    NULL,
  `has_toppings`         TINYINT(1)      NOT NULL DEFAULT 0,
  `production_station`   ENUM('PARRILLA','ENSAMBLE','BEBIDAS','OTRO') NOT NULL DEFAULT 'PARRILLA',
  `available_in`         ENUM('UNIVERSITARIO','ESPECIAL','AMBOS')     NOT NULL DEFAULT 'AMBOS',
  `is_active`            TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_products_category`       FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
  -- Al menos un precio debe existir
  CONSTRAINT `chk_prices_exist`           CHECK (`price_universitario` IS NOT NULL OR `price_especial` IS NOT NULL),
  -- El precio debe coincidir con la disponibilidad declarada
  CONSTRAINT `chk_price_menu_availability` CHECK (
    (available_in = 'UNIVERSITARIO' AND price_universitario IS NOT NULL) OR
    (available_in = 'ESPECIAL'      AND price_especial       IS NOT NULL) OR
    (available_in = 'AMBOS'         AND price_universitario  IS NOT NULL AND price_especial IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_products_category`      ON `products` (`category_id`);
-- Índice para filtro del catálogo POS por disponibilidad de menú
CREATE INDEX `idx_products_search`        ON `products` (`is_active`, `available_in`);
-- Índice para Kitchen Display: filtrar por estación de producción
CREATE INDEX `idx_products_station`       ON `products` (`production_station`, `is_active`);

-- CORRECCIÓN v4.0: category_id pasa a NOT NULL (bebidas sin categoría no aparecen en el POS)
-- CORRECCIÓN v4.0: ON DELETE SET NULL → ON DELETE RESTRICT (categoría no puede borrarse si tiene bebidas)
CREATE TABLE IF NOT EXISTS `beverages` (
  `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `category_id` BIGINT UNSIGNED NOT NULL,
  `sku`        VARCHAR(30)   NOT NULL UNIQUE,
  `name`       VARCHAR(80)   NOT NULL,
  `size`       ENUM('PEQUEÑO','MEDIANO','GRANDE','FAMILIAR') NOT NULL,
  `price`      DECIMAL(10,2) NOT NULL,
  `stock_qty`  INT           NOT NULL DEFAULT 0,
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1,
  CONSTRAINT `fk_beverages_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_beverage_price`    CHECK (`price` >= 0),
  CONSTRAINT `chk_beverage_stock`    CHECK (`stock_qty` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índice para catálogo POS: bebidas activas por categoría (pestaña dinámica)
CREATE INDEX `idx_beverages_active_category` ON `beverages` (`is_active`, `category_id`);

-- ------------------------------------------
-- Módulo 3: Toppings e Inventario Base
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS `inventory_items` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`          VARCHAR(120)  NOT NULL UNIQUE,
  `unit`          ENUM('GRAMO','UNIDAD','LITRO','MILILITRO','PORCION') NOT NULL,
  `current_stock` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `min_stock`     DECIMAL(12,3) NOT NULL,
  `max_stock`     DECIMAL(12,3) NULL,
  `cost_per_unit` DECIMAL(10,4) NOT NULL,
  `supplier`      VARCHAR(120)  NULL,
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1,
  -- NUEVO v4.0: validaciones de sanidad numérica
  CONSTRAINT `chk_inventory_stock_positive`    CHECK (`current_stock` >= 0),
  CONSTRAINT `chk_inventory_min_stock_positive` CHECK (`min_stock` >= 0),
  CONSTRAINT `chk_inventory_cost_positive`     CHECK (`cost_per_unit` > 0),
  CONSTRAINT `chk_inventory_max_gte_min`       CHECK (`max_stock` IS NULL OR `max_stock` >= `min_stock`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índice para alertas de inventario bajo mínimo
CREATE INDEX `idx_inventory_stock` ON `inventory_items` (`current_stock`, `min_stock`);

CREATE TABLE IF NOT EXISTS `toppings` (
  `id`                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`              VARCHAR(80)   NOT NULL,
  `extra_price`       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `category`          ENUM('SALSA','VEGETAL','PROTEINA','QUESO','OTRO') NOT NULL,
  `inventory_item_id` BIGINT UNSIGNED NULL,
  `is_active`         TINYINT(1)   NOT NULL DEFAULT 1,
  CONSTRAINT `fk_toppings_inventory` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_topping_price`     CHECK (`extra_price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_toppings_active` ON `toppings` (`is_active`);

CREATE TABLE IF NOT EXISTS `product_allowed_toppings` (
  `product_id` BIGINT UNSIGNED NOT NULL,
  `topping_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`product_id`, `topping_id`),
  CONSTRAINT `fk_allowed_toppings_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_allowed_toppings_topping` FOREIGN KEY (`topping_id`) REFERENCES `toppings`  (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índice para consultar toppings disponibles de un producto (UI de pedido)
CREATE INDEX `idx_prod_allowed_toppings` ON `product_allowed_toppings` (`product_id`);

-- ------------------------------------------
-- Módulo 4: Combos
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS `combos` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(120)  NOT NULL,
  `description` TEXT          NULL,
  `price`       DECIMAL(10,2) NOT NULL,
  `image_url`   VARCHAR(255)  NULL,
  `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
  `valid_from`  DATETIME      NULL,
  `valid_until` DATETIME      NULL,
  `created_by`  BIGINT UNSIGNED NOT NULL,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_combos_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  -- NUEVO v4.0: precio del combo debe ser positivo
  CONSTRAINT `chk_combo_price`   CHECK (`price` > 0),
  -- Validar coherencia de fechas de vigencia
  CONSTRAINT `chk_combo_dates`   CHECK (`valid_until` IS NULL OR `valid_from` IS NULL OR `valid_until` > `valid_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_combos_active_dates` ON `combos` (`is_active`, `valid_from`, `valid_until`);

CREATE TABLE IF NOT EXISTS `combo_products` (
  `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `combo_id`   BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `quantity`   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `menu_type`  ENUM('UNIVERSITARIO','ESPECIAL') NOT NULL,
  UNIQUE KEY `uq_combo_product` (`combo_id`, `product_id`),
  CONSTRAINT `fk_combo_products_combo`   FOREIGN KEY (`combo_id`)   REFERENCES `combos`   (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_combo_products_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `combo_beverages` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `combo_id`    BIGINT UNSIGNED  NOT NULL,
  `beverage_id` BIGINT UNSIGNED  NOT NULL,
  `quantity`    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY `uq_combo_beverage` (`combo_id`, `beverage_id`),
  CONSTRAINT `fk_combo_beverages_combo`   FOREIGN KEY (`combo_id`)    REFERENCES `combos`    (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_combo_beverages_beverage` FOREIGN KEY (`beverage_id`) REFERENCES `beverages` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------
-- Módulo 5: Reglas de Toppings por Menú
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS `menu_topping_rules` (
  `id`                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `menu_type`           ENUM('UNIVERSITARIO','ESPECIAL') NOT NULL UNIQUE,
  `max_toppings`        TINYINT UNSIGNED NULL,   -- NULL = ilimitado
  `allow_free_selection` TINYINT(1) NOT NULL DEFAULT 1,
  `description`         VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------
-- Módulo 6: Recetas
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS `recipes` (
  `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `product_id` BIGINT UNSIGNED NOT NULL UNIQUE,
  `name`       VARCHAR(120)    NOT NULL,
  `notes`      TEXT            NULL,
  `is_active`  TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_recipes_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recipe_ingredients` (
  `id`                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `recipe_id`         BIGINT UNSIGNED NOT NULL,
  `inventory_item_id` BIGINT UNSIGNED NOT NULL,
  `quantity`          DECIMAL(10,4)   NOT NULL,
  `unit`              ENUM('GRAMO','UNIDAD','LITRO','MILILITRO','PORCION') NOT NULL,
  UNIQUE KEY `uq_recipe_ingredient` (`recipe_id`, `inventory_item_id`),
  CONSTRAINT `fk_recipe_ingredients_recipe` FOREIGN KEY (`recipe_id`)         REFERENCES `recipes`         (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_recipe_ingredients_item`   FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_recipe_qty_positive`      CHECK (`quantity` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------
-- Módulo 7: Clientes y Zonas del Restaurante
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS `customers` (
  `id`             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `full_name`      VARCHAR(120)  NOT NULL,
  `phone`          VARCHAR(20)   NOT NULL UNIQUE,
  `email`          VARCHAR(120)  NULL UNIQUE,
  `address`        TEXT          NULL,
  `loyalty_points` INT UNSIGNED  NOT NULL DEFAULT 0,
  `total_orders`   INT UNSIGNED  NOT NULL DEFAULT 0,
  `total_spent`    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `birth_date`     DATE          NULL,
  `is_active`      TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índice primario de búsqueda de clientes (por teléfono en el POS)
CREATE INDEX `idx_customers_phone` ON `customers` (`phone`);

CREATE TABLE IF NOT EXISTS `zones` (
  `id`   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tables` (
  `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `zone_id`      BIGINT UNSIGNED  NOT NULL,
  `table_number` VARCHAR(10)      NOT NULL,
  `status`       ENUM('AVAILABLE','OCCUPIED','RESERVED') NOT NULL DEFAULT 'AVAILABLE',
  `capacity`     TINYINT UNSIGNED NOT NULL DEFAULT 4,
  CONSTRAINT `fk_tables_zone`   FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`) ON DELETE RESTRICT,
  UNIQUE KEY `uq_zone_table` (`zone_id`, `table_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_tables_status` ON `tables` (`status`);

-- ------------------------------------------
-- Módulo 8: Control de Caja y Sesiones (Arqueos)
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS `cash_registers` (
  `id`        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`      VARCHAR(60) NOT NULL UNIQUE,
  `is_active` TINYINT(1)  NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CORRECCIÓN v4.0:
--   • user_id → opened_by_user_id (claridad semántica)
--   • Agregar closed_by_user_id (puede ser diferente al que abrió)
--   • Agregar notes y discrepancy_notes para el arqueo
--   • CHECK opening_balance >= 0
CREATE TABLE IF NOT EXISTS `cash_sessions` (
  `id`                       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `opened_by_user_id`        BIGINT UNSIGNED  NOT NULL,
  `closed_by_user_id`        BIGINT UNSIGNED  NULL,
  `register_id`              BIGINT UNSIGNED  NOT NULL,
  `status`                   ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  `opening_balance`          DECIMAL(12,2)    NOT NULL,
  `closing_balance_expected` DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  `closing_balance_real`     DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  `discrepancy_amount`       DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  `notes`                    TEXT             NULL,       -- Observaciones al abrir
  `discrepancy_notes`        TEXT             NULL,       -- Justificación de diferencia
  `opened_at`                DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at`                DATETIME         NULL,
  CONSTRAINT `fk_cash_sessions_opener`   FOREIGN KEY (`opened_by_user_id`) REFERENCES `users`           (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cash_sessions_closer`   FOREIGN KEY (`closed_by_user_id`) REFERENCES `users`           (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cash_sessions_register` FOREIGN KEY (`register_id`)       REFERENCES `cash_registers`  (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_session_opening_bal`   CHECK (`opening_balance` >= 0),
  CONSTRAINT `chk_session_closed_after`  CHECK (`closed_at` IS NULL OR `closed_at` >= `opened_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índice para encontrar la sesión activa de un register (clave para abrir turno)
CREATE INDEX `idx_cash_sessions_register_status` ON `cash_sessions` (`register_id`, `status`);
-- Índice para reportes de caja por fecha
CREATE INDEX `idx_cash_sessions_status_date`     ON `cash_sessions` (`status`, `opened_at`);

-- ------------------------------------------
-- Módulo 9: Promociones
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS `promotions` (
  `id`                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`                VARCHAR(120)  NOT NULL,
  `description`         TEXT          NULL,
  `discount_type`       ENUM('PORCENTAJE','MONTO_FIJO','2X1','COMBO_PRECIO') NOT NULL,
  `discount_value`      DECIMAL(10,2) NOT NULL,
  `min_order_amount`    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `applies_to`          ENUM('PRODUCTO','BEBIDA','PEDIDO','COMBO') NOT NULL,
  `topping_rule_override` TINYINT(1)  NOT NULL DEFAULT 0,
  `max_uses`            INT           NULL,
  `uses_count`          INT UNSIGNED  NOT NULL DEFAULT 0,
  `valid_from`          DATETIME      NOT NULL,
  `valid_until`         DATETIME      NOT NULL,
  `is_active`           TINYINT(1)   NOT NULL DEFAULT 1,
  `created_by`          BIGINT UNSIGNED NOT NULL,
  `created_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_promotions_creator`   FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_promotion_dates`     CHECK (`valid_until` > `valid_from`),
  CONSTRAINT `chk_promotion_discount`  CHECK (`discount_value` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_promotions_active` ON `promotions` (`is_active`, `valid_from`, `valid_until`);

CREATE TABLE IF NOT EXISTS `promotion_products` (
  `promotion_id` BIGINT UNSIGNED  NOT NULL,
  `product_id`   BIGINT UNSIGNED  NOT NULL,
  `quantity`     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`promotion_id`, `product_id`),
  CONSTRAINT `fk_promotion_products_promo`   FOREIGN KEY (`promotion_id`) REFERENCES `promotions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_promotion_products_product` FOREIGN KEY (`product_id`)   REFERENCES `products`   (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `promotion_beverages` (
  `promotion_id` BIGINT UNSIGNED  NOT NULL,
  `beverage_id`  BIGINT UNSIGNED  NOT NULL,
  `quantity`     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`promotion_id`, `beverage_id`),
  CONSTRAINT `fk_promotion_beverages_promo`   FOREIGN KEY (`promotion_id`) REFERENCES `promotions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_promotion_beverages_beverage` FOREIGN KEY (`beverage_id`) REFERENCES `beverages`  (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------
-- Módulo 10: Pedidos (Módulo Central — Aggregate Root: Order)
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS `business_day_closures` (
  `id`                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `business_date`      DATE NOT NULL UNIQUE,
  `opened_at`          DATETIME NOT NULL,
  `closed_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_by_user_id`  BIGINT UNSIGNED NOT NULL,
  `total_orders_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `total_sales_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_cash_amount`  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_digital_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_card_amount`  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes`              TEXT NULL,
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_closures_user` FOREIGN KEY (`closed_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `daily_order_sequences` (
  `sequence_date` DATE NOT NULL PRIMARY KEY,
  `last_value`    INT UNSIGNED NOT NULL DEFAULT 0,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `orders` (
  `id`                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_number`       VARCHAR(32)   NOT NULL UNIQUE,
  `order_date`         DATE          NULL,
  `daily_order_number` INT UNSIGNED  NULL,
  `customer_id`        BIGINT UNSIGNED NULL,
  `user_id`            BIGINT UNSIGNED NOT NULL,
  `order_type`         ENUM('MESA','RECOGER','DOMICILIO') NOT NULL,
  `table_id`           BIGINT UNSIGNED NULL,
  `delivery_address`   TEXT          NULL,
  `delivery_user_id`   BIGINT UNSIGNED NULL,
  `delivery_company`   VARCHAR(100)  NULL,
  `status`             ENUM('PENDIENTE','CONFIRMADO','EN_PREPARACION','LISTO','ENTREGADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
  `promotion_id`       BIGINT UNSIGNED NULL,
  `subtotal`           DECIMAL(10,2) NOT NULL,
  `discount_amount`    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `tax_amount`         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `disposable_fee`     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `total`              DECIMAL(10,2) NOT NULL,
  `notes`              TEXT          NULL,
  `created_at`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `paid_at`            DATETIME      NULL,
  CONSTRAINT `fk_orders_customer`      FOREIGN KEY (`customer_id`)      REFERENCES `customers`  (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_orders_user`          FOREIGN KEY (`user_id`)          REFERENCES `users`      (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_orders_delivery_user` FOREIGN KEY (`delivery_user_id`) REFERENCES `users`      (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_orders_promotion`     FOREIGN KEY (`promotion_id`)     REFERENCES `promotions` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_orders_table`         FOREIGN KEY (`table_id`)         REFERENCES `tables`     (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_order_type_details`  CHECK (
    (order_type = 'MESA'      AND table_id         IS NOT NULL AND delivery_address IS NULL) OR
    (order_type = 'DOMICILIO' AND delivery_address IS NOT NULL AND table_id         IS NULL) OR
    (order_type = 'RECOGER'   AND table_id         IS NULL     AND delivery_address IS NULL)
  ),
  CONSTRAINT `chk_order_amounts` CHECK (`subtotal` >= 0 AND `total` >= 0 AND `discount_amount` >= 0 AND `tax_amount` >= 0 AND `disposable_fee` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `uq_orders_daily_number` ON `orders` (`order_date`, `daily_order_number`);
CREATE INDEX `idx_orders_status_created`  ON `orders` (`status`, `created_at`);
CREATE INDEX `idx_orders_status_type`     ON `orders` (`status`, `order_type`);
CREATE INDEX `idx_orders_customer`        ON `orders` (`customer_id`, `created_at` DESC);
CREATE INDEX `idx_orders_table_status`    ON `orders` (`table_id`, `status`);

-- ─── Combos en el pedido ───────────────────────────────────────────────────────
-- Cada fila es una instancia de combo comprada en este pedido.
-- Almacena nombre y precio histórico (snapshot) para inmutabilidad contable.
-- CORRECCIÓN AUDITADA: order_items.order_combo_id → order_combos.id (NO a combos.id)
-- Esto ya era correcto en v3.1 — se mantiene y se verifica.
CREATE TABLE IF NOT EXISTS `order_combos` (
  `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_id`   BIGINT UNSIGNED  NOT NULL,
  `combo_id`   BIGINT UNSIGNED  NOT NULL,
  `combo_name` VARCHAR(120)     NOT NULL,   -- Snapshot del nombre en el momento del pedido
  `quantity`   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(10,2)    NOT NULL,   -- Snapshot del precio del combo
  `line_total` DECIMAL(10,2)    NOT NULL,
  CONSTRAINT `fk_order_combos_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_combos_combo` FOREIGN KEY (`combo_id`) REFERENCES `combos`  (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_order_combo_qty`   CHECK (`quantity` > 0),
  CONSTRAINT `chk_order_combo_price` CHECK (`unit_price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_order_combos_order` ON `order_combos` (`order_id`);

-- ─── Ítems de producto en el pedido ───────────────────────────────────────────
-- Puede ser un ítem libre (order_combo_id IS NULL) o parte de un combo (order_combo_id NOT NULL).
-- order_combo_id referencia order_combos.id — instancia del combo en el pedido.
-- NUNCA referencia combos.id directamente (eso rompería la personalización).
CREATE TABLE IF NOT EXISTS `order_items` (
  `id`                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_id`            BIGINT UNSIGNED  NOT NULL,
  `product_id`          BIGINT UNSIGNED  NOT NULL,
  `order_combo_id`      BIGINT UNSIGNED  NULL,      -- NULL = ítem libre; NOT NULL = pertenece a un combo
  `quantity`            TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `menu_type`           ENUM('UNIVERSITARIO','ESPECIAL') NOT NULL,
  `unit_price`          DECIMAL(10,2)    NOT NULL,  -- Snapshot histórico de precio
  `toppings_extra_price` DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `line_total`          DECIMAL(10,2)    NOT NULL,
  `notes`               VARCHAR(255)     NULL,
  `product_name`        VARCHAR(120)     NULL,
  CONSTRAINT `fk_order_items_order`       FOREIGN KEY (`order_id`)       REFERENCES `orders`       (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_items_product`     FOREIGN KEY (`product_id`)     REFERENCES `products`     (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_order_items_order_combo` FOREIGN KEY (`order_combo_id`) REFERENCES `order_combos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_order_item_qty`         CHECK (`quantity` > 0),
  CONSTRAINT `chk_order_item_price`       CHECK (`unit_price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índice para cargar ítems de un pedido (findById del repositorio)
CREATE INDEX `idx_order_items_order`       ON `order_items` (`order_id`);
-- Índice para cargar ítems que pertenecen a un combo específico
CREATE INDEX `idx_order_items_order_combo` ON `order_items` (`order_combo_id`);
-- Índice para Kitchen Display: filtrar por estación de producción requiere JOIN con products
-- El índice en products.production_station ya cubre este caso.

-- ─── Toppings seleccionados por ítem ──────────────────────────────────────────
-- quantity: soporta "doble queso", "triple tocino" sin registros duplicados.
-- topping_name y extra_price: snapshots históricos (inmutabilidad contable).
CREATE TABLE IF NOT EXISTS `order_item_toppings` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_item_id` BIGINT UNSIGNED  NOT NULL,
  `topping_id`    BIGINT UNSIGNED  NOT NULL,
  `topping_name`  VARCHAR(80)      NOT NULL,  -- Snapshot del nombre
  `quantity`      TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `extra_price`   DECIMAL(10,2)    NOT NULL DEFAULT 0.00, -- Snapshot del precio
  CONSTRAINT `fk_order_item_toppings_item`    FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_item_toppings_topping` FOREIGN KEY (`topping_id`)    REFERENCES `toppings`    (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_topping_qty`                CHECK (`quantity` > 0),
  CONSTRAINT `chk_topping_extra_price`        CHECK (`extra_price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_order_item_toppings_item` ON `order_item_toppings` (`order_item_id`);

-- ─── Bebidas en el pedido ──────────────────────────────────────────────────────
-- order_combo_id: NULL = bebida libre; NOT NULL = pertenece a un combo.
CREATE TABLE IF NOT EXISTS `order_beverages` (
  `id`             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_id`       BIGINT UNSIGNED  NOT NULL,
  `beverage_id`    BIGINT UNSIGNED  NOT NULL,
  `order_combo_id` BIGINT UNSIGNED  NULL,
  `quantity`       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `unit_price`     DECIMAL(10,2)    NOT NULL,  -- Snapshot histórico de precio
  `line_total`     DECIMAL(10,2)    NOT NULL,
  CONSTRAINT `fk_order_beverages_order`       FOREIGN KEY (`order_id`)       REFERENCES `orders`       (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_beverages_beverage`    FOREIGN KEY (`beverage_id`)    REFERENCES `beverages`    (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_order_beverages_order_combo` FOREIGN KEY (`order_combo_id`) REFERENCES `order_combos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_order_bev_qty`             CHECK (`quantity` > 0),
  CONSTRAINT `chk_order_bev_price`           CHECK (`unit_price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_order_beverages_order`       ON `order_beverages` (`order_id`);
CREATE INDEX `idx_order_beverages_order_combo` ON `order_beverages` (`order_combo_id`);

-- ─── Historial de estado del pedido ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `order_status_history` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_id`    BIGINT UNSIGNED NOT NULL,
  `from_status` VARCHAR(30)     NOT NULL,
  `to_status`   VARCHAR(30)     NOT NULL,
  `changed_by`  BIGINT UNSIGNED NOT NULL,
  `notes`       VARCHAR(255)    NULL,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_status_history_order` FOREIGN KEY (`order_id`)   REFERENCES `orders` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_status_history_user`  FOREIGN KEY (`changed_by`) REFERENCES `users`  (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NUEVO v4.0: índice para cargar el historial de un pedido (auditoría, resolución de disputas)
CREATE INDEX `idx_order_status_history_order` ON `order_status_history` (`order_id`, `created_at`);

-- ------------------------------------------
-- Módulo 11: Medios de Pago y Transacciones
-- ------------------------------------------

-- MEJORADO v4.0:
--   • type: diferencia CASH (efectivo) de DIGITAL (Nequi, Daviplata, transferencia) y CARD (tarjeta)
--     → Necesario para el arqueo de caja: solo el efectivo cuenta para el dinero físico
--   • requires_reference: flag para exigir número de referencia en pagos digitales
--   • sort_order: permite ordenar los métodos en la UI del POS
CREATE TABLE IF NOT EXISTS `payment_methods` (
  `id`                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`               VARCHAR(50)  NOT NULL UNIQUE,
  `type`               ENUM('CASH','DIGITAL','CARD') NOT NULL DEFAULT 'CASH',
  `requires_reference` TINYINT(1)   NOT NULL DEFAULT 0,
  `sort_order`         SMALLINT     NOT NULL DEFAULT 0,
  `is_active`          TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_payment_methods_active` ON `payment_methods` (`is_active`, `sort_order`);

-- MEJORADO v4.0:
--   • status: permite marcar un pago como REVERTIDO sin borrarlo (integridad contable)
--   • change_amount: el vuelto entregado en pagos en efectivo
--   • notes: referencia de transacción o nota del cajero
--   • CHECK amount > 0: un pago de $0 no tiene sentido
CREATE TABLE IF NOT EXISTS `order_payments` (
  `id`                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_id`             BIGINT UNSIGNED NOT NULL,
  `payment_method_id`    BIGINT UNSIGNED NOT NULL,
  `session_id`           BIGINT UNSIGNED NOT NULL,
  `amount`               DECIMAL(10,2)   NOT NULL,
  `change_amount`        DECIMAL(10,2)   NOT NULL DEFAULT 0.00,  -- Vuelto del efectivo
  `transaction_reference` VARCHAR(100)   NULL,                   -- Referencia Nequi/Daviplata/tarjeta
  `status`               ENUM('COMPLETADO','REVERTIDO') NOT NULL DEFAULT 'COMPLETADO',
  `notes`                VARCHAR(255)    NULL,
  `created_at`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_order_payments_order`   FOREIGN KEY (`order_id`)          REFERENCES `orders`          (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_payments_method`  FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_order_payments_session` FOREIGN KEY (`session_id`)        REFERENCES `cash_sessions`   (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_payment_amount`        CHECK (`amount` > 0),
  CONSTRAINT `chk_payment_change`        CHECK (`change_amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índice para consultar pagos de un pedido (incluye pagos mixtos y reversiones)
CREATE INDEX `idx_order_payments_order`          ON `order_payments` (`order_id`, `status`);
-- Índice para reportes de caja: total recaudado por sesión y método de pago
CREATE INDEX `idx_order_payments_session_method` ON `order_payments` (`session_id`, `payment_method_id`);

-- MEJORADO v4.0:
--   • performed_by: el cajero que registró la transacción (auditoría)
--   • FK cascade → RESTRICT: una transacción de caja no puede borrarse si el pago se borra
CREATE TABLE IF NOT EXISTS `cash_transactions` (
  `id`               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `session_id`       BIGINT UNSIGNED NOT NULL,
  `transaction_type` ENUM('DEPOSIT','WITHDRAWAL','ORDER_PAYMENT') NOT NULL,
  `order_payment_id` BIGINT UNSIGNED NULL,    -- Opcional, si viene de una venta
  `amount`           DECIMAL(12,2)   NOT NULL,
  `performed_by`     BIGINT UNSIGNED NOT NULL, -- NUEVO v4.0: cajero responsable
  `notes`            TEXT            NULL,
  `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cash_tx_session`    FOREIGN KEY (`session_id`)       REFERENCES `cash_sessions`  (`id`) ON DELETE RESTRICT,
  -- CORRECCIÓN CRÍTICA v4.0: CASCADE → RESTRICT (no borrar registros contables)
  CONSTRAINT `fk_cash_tx_payment`    FOREIGN KEY (`order_payment_id`) REFERENCES `order_payments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cash_tx_performer`  FOREIGN KEY (`performed_by`)     REFERENCES `users`          (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_cash_tx_amount`    CHECK (`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índice para reportes de sesión de caja por tipo de transacción
CREATE INDEX `idx_cash_transactions_session`      ON `cash_transactions` (`session_id`, `transaction_type`);
-- Índice para auditoría por cajero
CREATE INDEX `idx_cash_transactions_performer`    ON `cash_transactions` (`performed_by`, `created_at`);

-- ------------------------------------------
-- Módulo 12: Auditoría de Inventario y Alertas
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS `inventory_movements` (
  `id`             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `item_id`        BIGINT UNSIGNED NOT NULL,
  `movement_type`  ENUM('ENTRADA','SALIDA','AJUSTE','MERMA') NOT NULL,
  `quantity`       DECIMAL(12,3)   NOT NULL,
  `unit_cost`      DECIMAL(10,4)   NULL,
  `reference_type` ENUM('PEDIDO','COMPRA','MANUAL','AJUSTE','RECETA') NOT NULL,
  `reference_id`   BIGINT UNSIGNED NULL,
  `notes`          TEXT            NULL,
  `performed_by`   BIGINT UNSIGNED NOT NULL,
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_movements_item` FOREIGN KEY (`item_id`)      REFERENCES `inventory_items` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_movements_user` FOREIGN KEY (`performed_by`) REFERENCES `users`           (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índice para auditoría de inventario por ítem
CREATE INDEX `idx_inventory_movements_item` ON `inventory_movements` (`item_id`, `created_at` DESC);

CREATE TABLE IF NOT EXISTS `inventory_alerts` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `item_id`       BIGINT UNSIGNED NOT NULL,
  `alert_type`    ENUM('STOCK_BAJO','SOBRESTOCK','SIN_STOCK') NOT NULL,
  `current_stock` DECIMAL(12,3)   NOT NULL,
  `threshold`     DECIMAL(12,3)   NOT NULL,
  `is_resolved`   TINYINT(1)      NOT NULL DEFAULT 0,
  `resolved_by`   BIGINT UNSIGNED NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at`   DATETIME        NULL,
  CONSTRAINT `fk_alerts_item` FOREIGN KEY (`item_id`)     REFERENCES `inventory_items` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_alerts_user` FOREIGN KEY (`resolved_by`) REFERENCES `users`           (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índice para panel de alertas pendientes (vista de inventario)
CREATE INDEX `idx_inventory_alerts_unresolved` ON `inventory_alerts` (`is_resolved`, `created_at`);

-- ------------------------------------------
-- Módulo 13: Auditoría de Puntos de Fidelización
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS `loyalty_transactions` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `order_id`    BIGINT UNSIGNED NULL,
  `points_delta` INT             NOT NULL,  -- Positivo = ganancia, negativo = redención
  `reason`      ENUM('COMPRA','CANJE','AJUSTE','CUMPLEAÑOS','BONO') NOT NULL,
  `notes`       VARCHAR(255)    NULL,
  `created_by`  BIGINT UNSIGNED NOT NULL,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_loyalty_transactions_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_loyalty_transactions_order`    FOREIGN KEY (`order_id`)    REFERENCES `orders`    (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_loyalty_transactions_user`     FOREIGN KEY (`created_by`)  REFERENCES `users`     (`id`) ON DELETE RESTRICT,
  UNIQUE KEY `uq_loyalty_order_reason` (`order_id`, `reason`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_loyalty_customer` ON `loyalty_transactions` (`customer_id`, `created_at` DESC);

-- ------------------------------------------
-- Módulo 14: Configuración del Negocio (Singleton)
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS `business_config` (
  `id`                 TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
  `business_name`      VARCHAR(120)  NOT NULL,
  `logo_url`           VARCHAR(255)  NULL,
  `address`            VARCHAR(255)  NULL,
  `phone`              VARCHAR(30)   NULL,
  `whatsapp`           VARCHAR(30)   NULL,
  `email`              VARCHAR(120)  NULL,
  `schedule`           JSON          NULL,
  `social_networks`    JSON          NULL,
  `ticket_message`     TEXT          NULL,
  `tax_percentage`     DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  `tax_included`       TINYINT(1)    NOT NULL DEFAULT 1,
  `delivery_base_cost` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `currency_symbol`    VARCHAR(5)    NOT NULL DEFAULT '$',
  `currency_code`      VARCHAR(5)    NOT NULL DEFAULT 'COP',
  `loyalty_active`     TINYINT(1)    NOT NULL DEFAULT 1,
  `promotions_active`  TINYINT(1)    NOT NULL DEFAULT 1,
  `points_per_peso`    DECIMAL(6,4)  NOT NULL DEFAULT 0.0000,
  `min_points_redeem`  INT           NOT NULL DEFAULT 0,
  `points_value`       DECIMAL(6,4)  NOT NULL DEFAULT 0.0000,
  `updated_at`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by`         BIGINT UNSIGNED NULL,
  CONSTRAINT `fk_business_config_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_singleton`           CHECK (`id` = 1),
  CONSTRAINT `chk_tax_percentage`      CHECK (`tax_percentage` >= 0 AND `tax_percentage` <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

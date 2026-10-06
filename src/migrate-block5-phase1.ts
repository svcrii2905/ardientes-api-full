import { connectDB, client, disconnectDB } from "./shared/infrastructure/database.ts";

export async function migrateBlock5Phase1(): Promise<void> {
  console.log("🚀 Ejecutando migración 100% aditiva e idempotente para Bloque 5 — Fase 1 (BD y Soporte Multi-Rol)...");

  // 1. Crear tabla `user_roles` si no existe
  console.log("   Verificando/creando tabla `user_roles`...");
  await client.execute(`
    CREATE TABLE IF NOT EXISTS \`user_roles\` (
      \`user_id\`    BIGINT UNSIGNED NOT NULL,
      \`role_id\`    BIGINT UNSIGNED NOT NULL,
      \`created_at\` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`user_id\`, \`role_id\`),
      CONSTRAINT \`fk_user_roles_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_user_roles_role\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\` (\`id\`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Crear índice en role_id si no existe
  try {
    await client.execute("CREATE INDEX `idx_user_roles_role` ON `user_roles` (`role_id`)");
  } catch (_e) {
    // Si el índice ya existe, continuar
  }

  // 2. Garantizar existencia de todos los roles (1..6)
  console.log("   Garantizando existencia de roles...");
  const roles = [
    { id: 1, name: "ADMIN", description: "Administrador general con acceso total al sistema" },
    { id: 2, name: "CAJERO", description: "Personal de caja: toma pedidos, factura y cierra pagos" },
    { id: 3, name: "COCINA", description: "Operadores del Kitchen Display System (KDS)" },
    { id: 4, name: "DOMICILIARIO", description: "Repartidores asignados a entregas externas" },
    { id: 5, name: "SUPERVISOR", description: "Supervisor de turno con permisos para anulaciones y ajustes de stock" },
    { id: 6, name: "MESERO", description: "Personal de salón / mesero: toma pedidos y gestiona mesas" },
  ];

  for (const r of roles) {
    await client.query(
      "INSERT INTO `roles` (`id`, `name`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `description` = VALUES(`description`)",
      [r.id, r.name, r.description]
    );
  }

  // 3. Garantizar existencia de permisos de mesas (13..16)
  console.log("   Garantizando existencia de permisos...");
  const permissions = [
    { id: 1, code: "orders:create", description: "Crear nuevos pedidos desde caja" },
    { id: 2, code: "orders:update_status", description: "Actualizar estado de pedidos (Cocina / Cajero)" },
    { id: 3, code: "orders:cancel", description: "Cancelar o anular pedidos confirmados" },
    { id: 4, code: "catalog:manage", description: "Administrar productos, bebidas y combos" },
    { id: 5, code: "inventory:read", description: "Visualizar niveles de stock y alertas" },
    { id: 6, code: "inventory:adjust", description: "Ingresar compras, mermas y ajustes manuales" },
    { id: 7, code: "config:write", description: "Modificar configuraciones globales del negocio" },
    { id: 8, code: "customers:manage", description: "Crear y buscar clientes para fidelización" },
    { id: 9, code: "payments:manage", description: "Registrar y revertir pagos de pedidos" },
    { id: 10, code: "cash_session:open", description: "Abrir turno / sesión de caja" },
    { id: 11, code: "cash_session:close", description: "Cerrar turno y realizar arqueo de caja" },
    { id: 12, code: "reports:read", description: "Consultar reportes de ventas e inventario" },
    { id: 13, code: "tables:read", description: "Consultar estado de mesas" },
    { id: 14, code: "tables:orders", description: "Crear y consultar pedidos de mesas" },
    { id: 15, code: "tables:request_bill", description: "Solicitar cuenta de mesas" },
    { id: 16, code: "tables:transfer", description: "Cambiar pedidos entre mesas" },
  ];

  for (const p of permissions) {
    await client.query(
      "INSERT INTO `permissions` (`id`, `code`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `code` = VALUES(`code`), `description` = VALUES(`description`)",
      [p.id, p.code, p.description]
    );
  }

  // 4. Asignar permisos al rol MESERO (id = 6)
  console.log("   Asignando permisos exactos al rol MESERO...");
  const meseroPerms = [1, 2, 8, 13, 14, 15, 16];
  for (const pid of meseroPerms) {
    await client.query(
      "INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) VALUES (6, ?)",
      [pid]
    );
  }

  // 5. Asignar permisos a ADMIN (id = 1)
  for (let pid = 1; pid <= 16; pid++) {
    await client.query(
      "INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) VALUES (1, ?)",
      [pid]
    );
  }

  // 6. Migrar usuarios existentes con role_id hacia user_roles
  console.log("   Migrando asignaciones de users.role_id hacia user_roles...");
  await client.execute(`
    INSERT IGNORE INTO \`user_roles\` (\`user_id\`, \`role_id\`)
    SELECT \`id\`, \`role_id\` FROM \`users\` WHERE \`role_id\` IS NOT NULL;
  `);

  console.log("✅ Migración de Bloque 5 — Fase 1 completada exitosamente.\n");
}

if (import.meta.main) {
  try {
    await connectDB();
    await migrateBlock5Phase1();
  } catch (error) {
    console.error("❌ Error en migración de Bloque 5 — Fase 1:", error);
    Deno.exit(1);
  } finally {
    await disconnectDB();
  }
}

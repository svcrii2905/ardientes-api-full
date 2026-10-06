import {
  connectDB,
    client,
    disconnectDB,
} from "./shared/infrastructure/database.ts";

async function main() {
  try {
    await connectDB();

    console.log(
      "Emptying database tables before seeding to avoid key conflicts...",
    );

    // Desactivar temporalmente la revisión de FKs para limpiar las tablas
    await client.execute("SET FOREIGN_KEY_CHECKS = 0");

    const tables = [
      "role_permissions",
      "users",
      "roles",
      "permissions",
      "menu_topping_rules",
      "business_config",
      "categories",
      "products",
      "beverages",
      "inventory_items",
      "toppings",
      "product_allowed_toppings",
      "combos",
      "combo_products",
      "combo_beverages",
      "recipes",
      "recipe_ingredients",
      "customers",
      "zones",
      "tables",
      "cash_registers",
      "cash_sessions",
      "orders",
      "order_combos",
      "order_items",
      "order_item_toppings",
      "order_beverages",
      "order_status_history",
      "payment_methods",
      "order_payments",
      "cash_transactions",
    ];

    for (const table of tables) {
      try {
        await client.execute(`TRUNCATE TABLE \`${table}\``);
      } catch (_e) {
        // Algunas tablas pueden no existir aún o dar error.
        // Se continúa con las demás tablas.
      }
    }

    console.log(
      "Seeding data from seed.sql using a single connection session...",
    );

    const seedSql = await Deno.readTextFile("./seed.sql");

    // Analizador simple que separa las sentencias por punto y coma,
    // ignorando los puntos y coma que estén dentro de strings.
    const statements: string[] = [];
    let currentStatement = "";
    let inString = false;
    let stringChar = "";
    let inComment = false;

    for (let i = 0; i < seedSql.length; i++) {
      const char = seedSql[i];
      const nextChar = seedSql[i + 1] || "";
      const previousChar = seedSql[i - 1] || "";

      // Manejar comentarios de línea --
      if (!inString && char === "-" && nextChar === "-") {
        inComment = true;
        i++; // Saltar el segundo guion
        continue;
      }

      if (inComment) {
        if (char === "\n" || char === "\r") {
          inComment = false;
        }
        continue;
      }

      // Manejar strings con comillas simples o dobles
      if (
        (char === "'" || char === '"') &&
        previousChar !== "\\"
      ) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = "";
        }
      }

      // Separar cada sentencia SQL
      if (char === ";" && !inString) {
        const statement = currentStatement.trim();

        if (statement.length > 0) {
          statements.push(statement);
        }

        currentStatement = "";
      } else {
        currentStatement += char;
      }
    }

    // Agregar la última sentencia si no termina en ;
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }

    console.log(`Found ${statements.length} SQL statements to execute.`);

    // Ejecutar las sentencias secuencialmente en la misma sesión
    for (const stmt of statements) {
      if (stmt.length === 0) {
        continue;
      }

      try {
        await client.execute(stmt);
      } catch (e) {
        const errorMessage = e instanceof Error
          ? e.message
          : String(e);

        console.error(`Error executing statement:\n${stmt.substring(0, 100)}...\nError: ${errorMessage}`);
      }
    }

    // Volver a activar la revisión de claves foráneas
    await client.execute("SET FOREIGN_KEY_CHECKS = 1");

    console.log("Database seeded successfully!");

    await disconnectDB();
  } catch (err) {
    console.error("Critical error seeding database:", err);

    try {
      await disconnectDB();
    } catch (_e) {
      // Ignorar error al cerrar la conexión
    }

    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
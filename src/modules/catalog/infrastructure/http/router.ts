import { Router } from "oak";
import { catalogDependencies } from "../dependencies.ts";
import { authMiddleware } from "../../../../shared/infrastructure/middleware/auth.middleware.ts";
import { requirePermission } from "../../../../shared/infrastructure/middleware/authorize.middleware.ts";

const catalogRouter = new Router({ prefix: "/api/v1/catalog" });

const { categoryController, productController } = catalogDependencies;

// Categories
catalogRouter.post(
  "/categories",
  authMiddleware,
  requirePermission("catalog:manage"),
  (ctx) => categoryController.create(ctx)
);

catalogRouter.get(
  "/categories",
  authMiddleware,
  (ctx) => categoryController.getAll(ctx)
);

// Products — GET con filtros opcionales (?categoryId=X&all=true)
catalogRouter.get(
  "/products",
  authMiddleware,
  (ctx) => productController.getAll(ctx)
);

catalogRouter.post(
  "/products",
  authMiddleware,
  requirePermission("catalog:manage"),
  (ctx) => productController.create(ctx)
);

// Toppings permitidos por producto
catalogRouter.get(
  "/products/:id/toppings",
  authMiddleware,
  (ctx) => productController.getProductToppings(ctx as any)
);

// Reglas de toppings por menú
catalogRouter.get(
  "/menu-rules",
  authMiddleware,
  (ctx) => productController.getMenuRules(ctx)
);

// Bebidas activas del catálogo (para selector de promos en POS)
catalogRouter.get(
  "/beverages",
  authMiddleware,
  (ctx) => productController.getBeverages(ctx)
);

export { catalogRouter };


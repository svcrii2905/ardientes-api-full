import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { connectDB, disconnectDB } from "../../../shared/infrastructure/database.ts";
import { authDependencies } from "../infrastructure/dependencies.ts";
import { authMiddleware } from "../../../shared/infrastructure/middleware/auth.middleware.ts";
import { requirePermission } from "../../../shared/infrastructure/middleware/authorize.middleware.ts";
import { UnauthorizedError, ForbiddenError } from "../../../shared/domain/error.ts";

function createMockContext(authHeader?: string) {
  const headers = new Map<string, string>();
  if (authHeader) headers.set("Authorization", authHeader);

  return {
    request: {
      headers: { get: (key: string) => headers.get(key) ?? null },
      url: new URL("http://localhost:8000/api/v1/users/drivers"),
    },
    response: {
      status: 200,
      body: null as any,
    },
    state: {},
  };
}

Deno.test("UserController - GET /api/v1/users/drivers", async (t) => {
  await connectDB();
  try {
    const { userController, jwtService } = authDependencies;
    const authorizeMiddleware = requirePermission("payments:manage");

    const createToken = async (id: number, roles: string[], permissions: string[]) => {
      const token = await jwtService.generateToken({
        id,
        username: "test",
        fullName: "Test User",
        roles,
        permissions,
        tokenVersion: 1,
        purpose: "session"
      } as any);
      return `Bearer ${token}`;
    };

    // Helper to run pipeline
    const runPipeline = async (ctx: any) => {
      // Mock db lookup for auth middleware since it queries db by ID
      // We will override user lookup or just use existing user ID 1 which is ADMIN
      // Wait, we can just populate ctx.state.user to bypass authMiddleware for authorization tests
    };

    await t.step("Usuario no autenticado recibe 401", async () => {
      const ctx = createMockContext();
      let error: any;
      try {
        await authMiddleware(ctx as any, async () => {});
      } catch (err) {
        error = err;
      }
      assertEquals(error instanceof UnauthorizedError, true);
    });

    const testAuthorization = async (roles: string[], permissions: string[], expectedError?: boolean) => {
      const ctx = createMockContext();
      ctx.state = {
        user: { id: 999, username: "test", fullName: "test", roles, permissions }
      };
      
      let error: any;
      try {
        await authorizeMiddleware(ctx as any, async () => {
          await userController.getDrivers(ctx as any);
        });
      } catch (err) {
        error = err;
      }

      if (expectedError) {
        assertEquals(error instanceof ForbiddenError, true);
      } else {
        assertEquals(error, undefined);
        assertEquals(ctx.response.status, 200);
        assertEquals(Array.isArray(ctx.response.body), true);
      }
      return ctx;
    };

    await t.step("ADMIN tiene acceso", async () => {
      await testAuthorization(["ADMIN"], []);
    });

    await t.step("CAJERO tiene acceso", async () => {
      await testAuthorization(["CAJERO"], ["payments:manage"]);
    });

    await t.step("SUPERVISOR tiene acceso", async () => {
      await testAuthorization(["SUPERVISOR"], ["payments:manage"]);
    });

    await t.step("COCINA recibe 403", async () => {
      await testAuthorization(["COCINA"], ["orders:update_status"], true);
    });

    await t.step("MESERO recibe 403", async () => {
      await testAuthorization(["MESERO"], ["orders:create", "tables:read"], true);
    });

    await t.step("DOMICILIARIO recibe 403", async () => {
      await testAuthorization(["DOMICILIARIO"], [], true);
    });

    await t.step("La respuesta contiene domiciliarios activos sin passwordHash", async () => {
      const ctx = await testAuthorization(["ADMIN"], []);
      const data = ctx.response.body;
      
      for (const driver of data) {
        assertEquals((driver as any).passwordHash, undefined);
        assertEquals(typeof driver.id, "number");
        assertEquals(typeof driver.fullName, "string");
      }
    });

  } finally {
    await disconnectDB();
  }
});

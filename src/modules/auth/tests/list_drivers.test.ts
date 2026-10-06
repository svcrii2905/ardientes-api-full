import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MySQLUserRepository } from "../infrastructure/mysql/MySQLUserRepository.ts";
import { ListDriversUseCase } from "../application/use-cases/ListDriversUseCase.ts";
import { connectDB, disconnectDB } from "../../../shared/infrastructure/database.ts";

Deno.test("ListDriversUseCase - Obtiene usuarios DOMICILIARIO", async () => {
  await connectDB();
  try {
    const repo = new MySQLUserRepository();
    const useCase = new ListDriversUseCase(repo);

    const drivers = await useCase.execute();

    // Comprobar que los resultados no contienen passwordHash ni tokenVersion
    for (const driver of drivers) {
      assertEquals((driver as any).passwordHash, undefined);
      assertEquals((driver as any).tokenVersion, undefined);
      assertEquals(typeof driver.id, "number");
      assertEquals(typeof driver.username, "string");
      assertEquals(typeof driver.fullName, "string");
    }
  } finally {
    await disconnectDB();
  }
});

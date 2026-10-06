import { Client } from "mysql";

async function main() {
  const rootClient = new Client();
  await rootClient.connect({
    hostname: "127.0.0.1",
    username: "root",
    password: "",
    db: "ardientes_pos",
    port: 3306
  });

  const appPass = "exs&H0Kd6f$3!vjId8#8T@%f";

  // Revocar privilegios globales / excesivos
  for (const host of ["localhost", "127.0.0.1", "%"]) {
    try {
      await rootClient.execute(`REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'ardientes_app'@'${host}';`);
    } catch (_e) {
      // ignorar si no existía el host o no tenía grant option
    }

    // Otorgar estrictamente los privilegios DML necesarios para operación normal de la aplicación
    await rootClient.execute(`GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON \`ardientes_pos\`.* TO 'ardientes_app'@'${host}' IDENTIFIED BY '${appPass}';`);
  }

  await rootClient.execute(`FLUSH PRIVILEGES;`);

  console.log("=== SHOW GRANTS FINAL DE ardientes_app ===");
  for (const host of ["localhost", "127.0.0.1", "%"]) {
    try {
      const grants = await rootClient.query(`SHOW GRANTS FOR 'ardientes_app'@'${host}';`);
      console.log(`\nGrants para 'ardientes_app'@'${host}':`);
      for (const g of grants) {
        console.log("  -", Object.values(g)[0]);
      }
    } catch (e) {
      console.log(`No grants for host ${host}:`, (e as Error).message);
    }
  }

  await rootClient.close();
}

main().catch(console.error);

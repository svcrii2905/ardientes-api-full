import { Client } from "mysql";

async function main() {
  const client = new Client();
  await client.connect({
    hostname: "127.0.0.1",
    username: "root",
    password: "",
    db: "ardientes_pos",
    port: 3306
  });

  const pass = "exs&H0Kd6f$3!vjId8#8T@%f";

  await client.execute(`CREATE USER IF NOT EXISTS 'ardientes_app'@'localhost' IDENTIFIED BY '${pass}';`);
  await client.execute(`ALTER USER 'ardientes_app'@'localhost' IDENTIFIED BY '${pass}';`);
  await client.execute(`GRANT ALL PRIVILEGES ON \`ardientes_pos\`.* TO 'ardientes_app'@'localhost';`);

  await client.execute(`CREATE USER IF NOT EXISTS 'ardientes_app'@'127.0.0.1' IDENTIFIED BY '${pass}';`);
  await client.execute(`ALTER USER 'ardientes_app'@'127.0.0.1' IDENTIFIED BY '${pass}';`);
  await client.execute(`GRANT ALL PRIVILEGES ON \`ardientes_pos\`.* TO 'ardientes_app'@'127.0.0.1';`);

  await client.execute(`CREATE USER IF NOT EXISTS 'ardientes_app'@'%' IDENTIFIED BY '${pass}';`);
  await client.execute(`ALTER USER 'ardientes_app'@'%' IDENTIFIED BY '${pass}';`);
  await client.execute(`GRANT ALL PRIVILEGES ON \`ardientes_pos\`.* TO 'ardientes_app'@'%';`);

  await client.execute(`FLUSH PRIVILEGES;`);
  console.log("SUCCESS: All privileges and password set for ardientes_app on localhost, 127.0.0.1, and %");

  await client.close();
}

main().catch(console.error);

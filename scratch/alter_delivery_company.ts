import mysql from 'npm:mysql2/promise';

async function run() {
  try {
    const conn = await mysql.createConnection({
      host: "127.0.0.1",
      user: "root",
      password: "",
      database: "ardientes_pos"
    });
    console.log("ROOT CONNECTED");
    await conn.query(`ALTER TABLE orders ADD COLUMN delivery_company VARCHAR(100) NULL AFTER delivery_user_id;`);
    console.log("Migration successful");
    await conn.end();
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

run();

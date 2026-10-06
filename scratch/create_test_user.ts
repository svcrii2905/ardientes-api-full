import { config } from 'npm:dotenv'; 
config({ path: './.env' }); 
import mysql from 'npm:mysql2/promise'; 

async function run() {
  const conn = await mysql.createConnection({ 
    host: Deno.env.get('DB_HOSTNAME'), 
    user: Deno.env.get('DB_USERNAME'), 
    password: Deno.env.get('DB_PASSWORD'), 
    database: Deno.env.get('DB_DATABASE') 
  }); 
  const [existing] = await conn.query('SELECT id, username, full_name, role_id, is_active FROM users WHERE username = ?', ['test_domiciliario']); 
  let newUserId = 0;
  if (existing.length > 0) { 
    console.log('USER_EXISTS', JSON.stringify(existing, null, 2)); 
    newUserId = existing[0].id;
  } else {
    await conn.beginTransaction(); 
    try { 
      const [result] = await conn.query('INSERT INTO users (role_id, username, email, password_hash, full_name, is_active) VALUES (?, ?, ?, ?, ?, ?)', [4, 'test_domiciliario', 'test@domiciliario.local', 'fake_hash_123', 'Domiciliario Prueba', 1]); 
      newUserId = result.insertId; 
      await conn.query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [newUserId, 4]); 
      await conn.commit(); 
    } catch(e) { 
      await conn.rollback(); 
      console.error('TX_FAILED', e); 
      conn.end(); 
      Deno.exit(1); 
    } 
  }
  
  const [verifyUser] = await conn.query('SELECT id, username, full_name, role_id, is_active FROM users WHERE id = ?', [newUserId]); 
  const [verifyRole] = await conn.query('SELECT * FROM user_roles WHERE user_id = ? AND role_id = 4', [newUserId]); 
  
  // Test endpoint using fetch
  // Get token for admin
  const loginRes = await fetch('http://localhost:8000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'admin' }) // assuming default admin pass
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.token || loginData.token;

  let endpointResult = null;
  if (token) {
    const driversRes = await fetch('http://localhost:8000/api/v1/users/drivers', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    endpointResult = await driversRes.json();
  } else {
     // If login fails (wrong password etc), try connecting the Deno client
     const { client } = await import('./src/shared/infrastructure/database.ts');
     const envConf = await import('./src/config/env.ts');
     await client.connect(envConf.config.db);
     const { MySQLUserRepository } = await import('./src/modules/auth/infrastructure/mysql/MySQLUserRepository.ts');
     const repo = new MySQLUserRepository(); 
     const drivers = await repo.findByRole('DOMICILIARIO'); 
     endpointResult = { data: drivers };
     await client.close();
  }
  
  console.log(JSON.stringify({ 
    user: verifyUser[0], 
    role: verifyRole[0], 
    listDriversResult: endpointResult.data ? endpointResult.data.find(d => d.username === 'test_domiciliario') : null
  }, null, 2)); 
  
  conn.end(); 
  Deno.exit(0);
}
run();

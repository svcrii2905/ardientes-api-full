import { connectDB, disconnectDB, client } from "./src/shared/infrastructure/database.ts"; 
async function run() { 
  await connectDB(); 
  await client.execute(`UPDATE beverages SET size='PEQUE├æO' WHERE id IN (4,5,6,7)`); 
  await disconnectDB(); 
  console.log("Done"); 
} 
run();

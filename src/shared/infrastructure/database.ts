import { Client } from "mysql";
import { config } from "../../config/env.ts";

/**
 * Contrato para ejecutar consultas SQL (DDL / DML / SELECT).
 * Puede ser la instancia de Client (pool) o una conexión aislada dentro de una transacción.
 */
export interface QueryExecutor {
  execute(sql: string, params?: any[]): Promise<any>;
  query(sql: string, params?: any[]): Promise<any>;
}

/**
 * Gestor de transacciones atómicas con aislamiento de conexión.
 * Cada transacción obtiene su propia conexión del pool de MySQL,
 * ejecuta BEGIN, realiza las operaciones requeridas, hace COMMIT en éxito
 * o ROLLBACK ante fallos y devuelve la conexión al pool.
 */
export class TransactionManager {
  constructor(private readonly dbClient: Client) {}

  /**
   * Ejecuta un callback dentro de una transacción aislada.
   */
  async runInTransaction<T>(callback: (exec: QueryExecutor) => Promise<T>): Promise<T> {
    return await this.dbClient.transaction(async (conn) => {
      return await callback(conn);
    });
  }
}

export const client = new Client();
export const transactionManager = new TransactionManager(client);

export async function connectDB() {
  await client.connect({
    hostname: config.db.hostname,
    username: config.db.username,
    password: config.db.password,
    db: config.db.database,
    port: config.db.port,
    poolSize: config.db.poolSize,
  });
  console.log(`Connected to MySQL database: ${config.db.database} (pool size: ${config.db.poolSize})`);
}

export async function disconnectDB() {
  await client.close();
  console.log("Disconnected from MySQL database");
}


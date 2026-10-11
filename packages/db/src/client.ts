import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;
export type DbClient = { db: Database; pool: Pool };
/** A Drizzle transaction handle. Money code takes an `Executor` so it can join the caller's transaction. */
export type DbTx = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Executor = Database | DbTx;

/** Creates a pooled Drizzle client. Callers own the pool and must `pool.end()` on shutdown. */
export function createDb(connectionString: string, opts: PoolConfig = {}): DbClient {
  const pool = new Pool({ connectionString, max: 10, ...opts });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });
  return { db, pool };
}

export { schema };

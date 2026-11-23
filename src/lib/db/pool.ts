import "server-only";
import { Pool, type QueryResultRow } from "pg";

/** Anything that can run a parameterized query: a Pool, a PoolClient inside a transaction, etc. */
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[]; rowCount: number | null }>;
}

/** A pool that can lend one connection for a transaction. `pg.Pool` satisfies it. */
export interface Database extends Queryable {
  connect(): Promise<Queryable & { release(): void }>;
}

/** Runs `fn` inside BEGIN/COMMIT on one connection, rolling back if it throws. */
export async function withTransaction<T>(
  db: Database,
  fn: (tx: Queryable) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

let pool: Pool | undefined;

/** The app-wide pool. Library code takes a `Queryable` instead, so tests can pass their own. */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString, max: 5 });
  }
  return pool;
}

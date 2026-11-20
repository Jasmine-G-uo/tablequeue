import "server-only";
import { Pool, type QueryResultRow } from "pg";

/** Anything that can run a parameterized query: a Pool, a PoolClient inside a transaction, etc. */
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[]; rowCount: number | null }>;
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

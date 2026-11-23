// Helpers for integration tests: one pool per test file, and a way to start each test clean.
import { Pool } from "pg";
import { testDatabaseUrl } from "./env";

export function createTestPool(): Pool {
  return new Pool({ connectionString: testDatabaseUrl(), max: 4 });
}

export async function truncate(pool: Pool, tables: string[]): Promise<void> {
  await pool.query(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
}

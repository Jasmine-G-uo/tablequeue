// Applies db/migrations/*.sql in filename order, once each, recording them in schema_migrations.
// Usage: npm run db:migrate            (uses DATABASE_URL, loaded from .env.local if present)
//        migrate(url) from test setup  (integration tests pass TEST_DATABASE_URL)
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const migrationsDir = fileURLToPath(new URL("../db/migrations/", import.meta.url));

export async function migrate(connectionString, { log = console.log } = {}) {
  if (!connectionString) throw new Error("migrate: no database URL given");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.name));
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        log(`applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`migration ${file} failed: ${error.message}`, { cause: error });
      }
    }
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate(process.env.DATABASE_URL).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

// Loads .env.local (if present) without overriding variables already set, e.g. by CI.
export function loadLocalEnv(): void {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local (CI or fresh clone): rely on the process environment.
  }
}

export function testDatabaseUrl(): string {
  loadLocalEnv();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  return url;
}

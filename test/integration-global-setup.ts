// Vitest globalSetup for the integration project: bring the test database to the latest schema.
import { migrate } from "../scripts/migrate.mjs";
import { testDatabaseUrl } from "./env";

export default async function setup(): Promise<void> {
  await migrate(testDatabaseUrl(), { log: () => {} });
}

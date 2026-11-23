import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));
const serverOnlyStub = fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": srcDir, "server-only": serverOnlyStub },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          // Domain and server code run in node. Component tests opt in to the DOM with
          // a `// @vitest-environment jsdom` comment at the top of the file.
          environment: "node",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.integration.test.{ts,tsx}"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.integration.test.{ts,tsx}"],
          // Migrates TEST_DATABASE_URL (from .env.local locally, from the workflow env in CI).
          globalSetup: ["./test/integration-global-setup.ts"],
          // Test files share one database, so run them one at a time.
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      reporter: ["text", "html", "lcov"],
      thresholds: {
        // Per-module thresholds are added here as modules land.
        // Queue domain module (issue #3) will set: "src/lib/queue/**": { lines, functions, branches, statements }
        // Auth (issue #2): the files covered by unit tests. config.ts, users.ts, throttle.ts, and
        // authenticate.ts run against PostgreSQL in the integration project, which is not counted yet.
        "src/lib/auth/{validation,password,guards}.ts": {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
      },
    },
  },
});

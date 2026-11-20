import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": srcDir },
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
      },
    },
  },
});

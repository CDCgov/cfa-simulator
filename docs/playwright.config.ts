import { defineConfig } from "@playwright/test";
import vitepressConfig from "./.vitepress/config";

const base = vitepressConfig.base ?? "/";

export default defineConfig({
  testDir: "../cfasim-ui",
  testMatch: "*.spec.ts",
  // Every test navigates to its own page, so tests within one spec file can
  // share the worker pool instead of running serially per file.
  fullyParallel: true,
  webServer: {
    command: "pnpm exec vitepress dev --port 6140 --host 127.0.0.1",
    port: 6140,
    reuseExistingServer: false,
  },
  use: {
    baseURL: `http://localhost:6140${base}`,
  },
});

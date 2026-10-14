import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  // Every test navigates to its own page, so tests within one spec file can
  // share the worker pool instead of running serially per file.
  fullyParallel: true,
  timeout: 60_000,
  webServer: {
    command: "pnpm exec vite --port 7300",
    port: 7300,
    reuseExistingServer: false,
  },
  use: {
    baseURL: "http://localhost:7300",
  },
});

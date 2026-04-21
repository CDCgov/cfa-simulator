import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 60_000,
  globalSetup: "./playwright.setup.ts",
  webServer: {
    command: "pnpm exec vite --port 7300 --strictPort",
    port: 7300,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:7300",
  },
});

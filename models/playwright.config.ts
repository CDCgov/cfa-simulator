import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
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

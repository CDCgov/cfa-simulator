import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 60_000,
  webServer: {
    command: "pnpm exec vite --port 7301",
    port: 7301,
    reuseExistingServer: false,
  },
  use: {
    baseURL: "http://localhost:7301",
  },
});

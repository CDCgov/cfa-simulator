import { defineConfig } from "@playwright/test";

const WEB_SERVER_TIMEOUT_MS = Number(
  process.env.PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS ?? "300000",
);

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 90_000,
  webServer: {
    command: "pnpm exec vite --port 7300 --strictPort",
    port: 7300,
    reuseExistingServer: false,
    timeout: WEB_SERVER_TIMEOUT_MS,
  },
  use: {
    baseURL: "http://localhost:7300",
  },
});

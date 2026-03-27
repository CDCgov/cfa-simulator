import { defineConfig } from "@playwright/test";
import vitepressConfig from "./.vitepress/config";

const base = vitepressConfig.base ?? "/";

export default defineConfig({
  testDir: "../cfasim-ui",
  testMatch: "*.spec.ts",
  webServer: {
    command: "pnpm exec vitepress dev --port 6140 --host 127.0.0.1",
    port: 6140,
    reuseExistingServer: false,
  },
  use: {
    baseURL: `http://localhost:6140${base}`,
  },
});

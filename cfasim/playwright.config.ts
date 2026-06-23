import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  testIgnore: ["src/templates/**", "**/node_modules/**"],
  timeout: 300_000,
  use: {
    ignoreHTTPSErrors: true,
  },
});

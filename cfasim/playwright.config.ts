import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  testIgnore: ["src/templates/**", "**/node_modules/**"],
  timeout: 120_000,
});

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  // Every test navigates to its own page, so tests within one spec file can
  // share the worker pool instead of running serially per file.
  fullyParallel: true,
  timeout: 60_000,
  // Serves the production build (`plz models test` depends on
  // `models.build`), so the tests see the real chunks and the wasm-pack
  // builds happen in a logged build step. Preview still runs the plugin's
  // config hook, so wasm-pack runs once more, incrementally.
  webServer: {
    command: "pnpm exec vite preview --port 7300",
    port: 7300,
    reuseExistingServer: false,
    timeout: 300_000,
  },
  use: {
    baseURL: "http://localhost:7300",
  },
});

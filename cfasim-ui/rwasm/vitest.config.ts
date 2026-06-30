import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // rConvert.ts is pure (no `webr` import), so the conversion/call helpers
    // test runs without the webR runtime installed.
    environment: "happy-dom",
  },
});

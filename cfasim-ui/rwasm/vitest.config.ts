import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // The worker module assigns `self.onmessage` at import time; happy-dom
    // provides `self` so the exported pure helpers can be imported under test.
    environment: "happy-dom",
  },
});

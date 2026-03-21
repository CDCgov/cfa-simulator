import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["cfasim-ui/*/vitest.config.ts"],
  },
});

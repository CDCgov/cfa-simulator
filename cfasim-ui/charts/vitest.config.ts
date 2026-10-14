import { configDefaults, defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "happy-dom",
    // Spread the defaults back in: overriding `exclude` drops the
    // node_modules rule, which made the symlinked @cfasim-ui/shared tests
    // run again here.
    exclude: [...configDefaults.exclude, "src/**/*.spec.ts"],
  },
});

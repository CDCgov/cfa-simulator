import { execSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";

function cfasimWasm(modelDir = "model"): Plugin {
  return {
    name: "cfasim-wasm",
    configResolved(config) {
      const name = basename(config.root);
      const outDir = resolve(config.root, "public", "wasm", name);
      execSync(`wasm-pack build ${modelDir} --target web --out-dir ${outDir}`, {
        cwd: config.root,
        stdio: "pipe",
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), cfasimWasm()],
});

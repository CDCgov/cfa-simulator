import { execSync } from "node:child_process";
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";

function cfasimPyodide(modelDir = "model"): Plugin {
  return {
    name: "cfasim-pyodide",
    configResolved(config) {
      const publicDir = resolve(config.root, "public");
      mkdirSync(publicDir, { recursive: true });
      execSync(`uv build ${modelDir} --wheel --out-dir public`, {
        cwd: config.root,
        stdio: "inherit",
      });
      const wheels = readdirSync(publicDir).filter((f) => f.endsWith(".whl"));
      writeFileSync(resolve(publicDir, "wheels.json"), JSON.stringify(wheels));
    },
  };
}

export default defineConfig({
  plugins: [vue(), cfasimPyodide()],
});

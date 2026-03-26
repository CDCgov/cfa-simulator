import { execSync } from "node:child_process";
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

interface CfasimPyodideOptions {
  /** Path to the Python model directory (default: "model") */
  model?: string;
  /** Additional local package directories to build as wheels */
  deps?: string[];
}

/**
 * Vite plugin that builds a Python wheel from a local model directory
 * and generates wheels.json in the public directory.
 */
export function cfasimPyodide(options?: CfasimPyodideOptions): Plugin {
  const modelDir = options?.model ?? "model";

  function build(root: string) {
    const publicDir = resolve(root, "public");
    mkdirSync(publicDir, { recursive: true });
    for (const dep of options?.deps ?? []) {
      execSync(`uv build ${dep} --wheel --out-dir public`, {
        cwd: root,
        stdio: "pipe",
      });
    }
    execSync(`uv build ${modelDir} --wheel --out-dir public`, {
      cwd: root,
      stdio: "pipe",
    });
    const wheels = readdirSync(publicDir).filter((f) => f.endsWith(".whl"));
    writeFileSync(resolve(publicDir, "wheels.json"), JSON.stringify(wheels));
  }

  return {
    name: "cfasim-pyodide",
    configResolved(config) {
      build(config.root);
    },
  };
}

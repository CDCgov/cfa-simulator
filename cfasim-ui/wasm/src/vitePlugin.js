import { execSync } from "node:child_process";
import { basename, resolve } from "node:path";

/**
 * @typedef {object} CfasimWasmOptions
 * @property {string} [model] Path to the Rust model directory (default: "model")
 * @property {string} [name] Output name used for the wasm module (default: project directory name)
 */

/**
 * Vite plugin that builds a Rust model to WebAssembly via wasm-pack
 * and outputs it to public/wasm/{name}/.
 *
 * @param {CfasimWasmOptions} [options]
 * @returns {import("vite").Plugin}
 */
export function cfasimWasm(options) {
  const modelDir = options?.model ?? "model";

  function build(root) {
    const name = (options?.name ?? basename(root)).replace(/-/g, "_");
    const outDir = resolve(root, "public", "wasm", name);
    execSync(`wasm-pack build ${modelDir} --target web --out-dir ${outDir}`, {
      cwd: root,
      stdio: "pipe",
    });
  }

  return {
    name: "cfasim-wasm",
    configResolved(config) {
      build(config.root);
    },
  };
}

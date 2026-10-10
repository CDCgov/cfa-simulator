import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

/**
 * @typedef {object} CfasimWasmOptions
 * @property {string} [model] Path to the Rust model directory (default: "model")
 * @property {string} [name] Output name used for the wasm module (default: project directory name)
 */

/** Global injected via Vite `define`; the worker appends it as `?v=` to wasm URLs. */
export const WASM_VERSIONS_DEFINE = "__CFASIM_WASM_VERSIONS__";

/**
 * Hash the wasm-pack output for a model so its URLs change whenever the
 * compiled module or its JS glue changes. Both are served from fixed paths
 * under public/, so without this a CDN or browser cache can pair a new app
 * bundle with a stale wasm build.
 *
 * @param {string} outDir wasm-pack output directory
 * @param {string} name wasm module name
 * @returns {string} 12 hex chars of sha256 over `<name>_bg.wasm` + `<name>.js`
 */
export function hashWasmOutput(outDir, name) {
  const hash = createHash("sha256");
  for (const file of [`${name}_bg.wasm`, `${name}.js`]) {
    hash.update(readFileSync(resolve(outDir, file)));
  }
  return hash.digest("hex").slice(0, 12);
}

/**
 * Vite plugin that builds a Rust model to WebAssembly via wasm-pack
 * and outputs it to public/wasm/{name}/.
 *
 * The build runs in the `config` hook so the output hash can be exposed to
 * the app through `define` as `__CFASIM_WASM_VERSIONS__` (a map of model
 * name to hash). Several instances merge into the same map.
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
    return { name, version: hashWasmOutput(outDir, name) };
  }

  return {
    name: "cfasim-wasm",
    config(userConfig) {
      // Mirrors Vite's own root resolution, which has not happened yet.
      const root = userConfig.root ? resolve(userConfig.root) : process.cwd();
      const { name, version } = build(root);
      const existing = userConfig.define?.[WASM_VERSIONS_DEFINE];
      const versions = typeof existing === "string" ? JSON.parse(existing) : {};
      versions[name] = version;
      return { define: { [WASM_VERSIONS_DEFINE]: JSON.stringify(versions) } };
    },
  };
}

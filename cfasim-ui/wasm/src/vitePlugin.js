import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  execFileAsync,
  ignoreGlob,
  resolvePublicDir,
  resolveRoot,
  watchModel,
} from "@cfasim-ui/shared/vite";

/**
 * @typedef {object} CfasimWasmOptions
 * @property {string} [model] Path to the Rust model directory (default: "model")
 * @property {string} [name] Output name used for the wasm module (default: project directory name)
 * @property {boolean | string[]} [watch] Rebuild and reload the dev server when the model's `src/` or `Cargo.toml` changes (default: true). An array adds more paths to watch, relative to the Vite root like `model`, e.g. a path dependency's `src/`. `false` builds once at startup only.
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
 * and outputs it to `<publicDir>/wasm/{name}/`.
 *
 * The build runs in the `config` hook so the output hash can be exposed to
 * the app through `define` as `__CFASIM_WASM_VERSIONS__` (a map of model
 * name to hash). Several instances merge into the same map.
 *
 * In `vite dev` the model's `src/` and `Cargo.toml` are watched: a change
 * rebuilds in the background and reloads the page. The hash in `define` is
 * fixed for the server's lifetime, which is fine in dev because Vite serves
 * `publicDir` with `Cache-Control: no-cache`. The crate's `target/` is
 * hidden from Vite's watcher altogether, since cargo writes thousands of
 * files there per build.
 *
 * @param {CfasimWasmOptions} [options]
 * @returns {import("vite").Plugin}
 */
export function cfasimWasm(options) {
  const modelDir = options?.model ?? "model";
  const watch = options?.watch ?? true;
  const pluginName = "cfasim-wasm";

  /**
   * @param {string} root Resolved Vite root
   * @param {string} publicDir Resolved Vite public directory
   */
  function target(root, publicDir) {
    const name = (options?.name ?? basename(root)).replace(/-/g, "_");
    const outDir = resolve(publicDir, "wasm", name);
    return {
      name,
      outDir,
      args: ["build", modelDir, "--target", "web", "--out-dir", outDir],
    };
  }

  /**
   * @param {string} root
   * @param {string} publicDir
   */
  async function build(root, publicDir) {
    const { name, outDir, args } = target(root, publicDir);
    await execFileAsync("wasm-pack", args, root);
    return { name, version: hashWasmOutput(outDir, name) };
  }

  return {
    name: pluginName,
    async config(userConfig) {
      // Vite has not resolved root or publicDir yet; mirror its resolution.
      const root = resolveRoot(userConfig);
      const publicDir = resolvePublicDir(
        root,
        userConfig.publicDir,
        pluginName,
      );
      const { name, version } = await build(root, publicDir);
      const existing = userConfig.define?.[WASM_VERSIONS_DEFINE];
      const versions = typeof existing === "string" ? JSON.parse(existing) : {};
      versions[name] = version;
      return {
        define: { [WASM_VERSIONS_DEFINE]: JSON.stringify(versions) },
        server: {
          watch: { ignored: [ignoreGlob(resolve(root, modelDir, "target"))] },
        },
      };
    },
    configureServer(server) {
      const { root } = server.config;
      const publicDir = resolvePublicDir(
        root,
        server.config.publicDir,
        pluginName,
      );
      const { name, args } = target(root, publicDir);
      watchModel(server, {
        name: `${pluginName} (${name})`,
        model: modelDir,
        manifest: "Cargo.toml",
        watch,
        outputs: ["target"],
        publicDir,
        build: () => execFileAsync("wasm-pack", args, root),
      });
    },
  };
}

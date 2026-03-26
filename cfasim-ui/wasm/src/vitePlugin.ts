import { execSync } from "node:child_process";
import { basename, resolve } from "node:path";
import type { Plugin } from "vite";

interface CfasimWasmOptions {
  /** Path to the Rust model directory (default: "model") */
  model?: string;
  /** Output name used for the wasm module (default: project directory name) */
  name?: string;
}

/**
 * Vite plugin that builds a Rust model to WebAssembly via wasm-pack
 * and outputs it to public/wasm/{name}/.
 */
export function cfasimWasm(options?: CfasimWasmOptions): Plugin {
  const modelDir = options?.model ?? "model";

  function build(root: string) {
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

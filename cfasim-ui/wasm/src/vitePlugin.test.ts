import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import {
  cfasimWasm,
  hashWasmOutput,
  WASM_VERSIONS_DEFINE,
} from "./vitePlugin.js";

vi.mock("node:child_process", () => ({ execSync: vi.fn() }));

let root: string;

function writeOutput(name: string, wasm: string, js: string) {
  const dir = resolve(root, "public", "wasm", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `${name}_bg.wasm`), wasm);
  writeFileSync(resolve(dir, `${name}.js`), js);
  return dir;
}

function runConfig(
  plugin: ReturnType<typeof cfasimWasm>,
  userConfig: Record<string, unknown>,
): Record<string, string> {
  const hook = plugin.config as (c: unknown) => {
    define: Record<string, string>;
  };
  return JSON.parse(hook(userConfig).define[WASM_VERSIONS_DEFINE]);
}

beforeEach(() => {
  root = mkdtempSync(resolve(tmpdir(), "cfasim-wasm-"));
  vi.mocked(execSync).mockClear();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("hashWasmOutput", () => {
  it("changes when either the wasm or the glue changes", () => {
    const dir = writeOutput("m", "wasm-a", "js-a");
    const base = hashWasmOutput(dir, "m");
    expect(base).toMatch(/^[0-9a-f]{12}$/);
    expect(hashWasmOutput(dir, "m")).toBe(base);

    writeOutput("m", "wasm-b", "js-a");
    const wasmChanged = hashWasmOutput(dir, "m");
    expect(wasmChanged).not.toBe(base);

    writeOutput("m", "wasm-b", "js-b");
    expect(hashWasmOutput(dir, "m")).not.toBe(wasmChanged);
  });
});

describe("cfasimWasm", () => {
  it("builds with wasm-pack and defines the output hash by model name", () => {
    const dir = writeOutput("my_sim", "wasm", "js");
    const versions = runConfig(cfasimWasm({ model: "..", name: "my-sim" }), {
      root,
    });
    expect(versions).toEqual({ my_sim: hashWasmOutput(dir, "my_sim") });
    expect(execSync).toHaveBeenCalledWith(
      `wasm-pack build .. --target web --out-dir ${dir}`,
      expect.objectContaining({ cwd: root }),
    );
  });

  it("merges into a versions map defined by an earlier instance", () => {
    const a = writeOutput("a", "wasm-a", "js-a");
    const b = writeOutput("b", "wasm-b", "js-b");
    const first = runConfig(cfasimWasm({ name: "a" }), { root });
    const second = runConfig(cfasimWasm({ name: "b" }), {
      root,
      define: { [WASM_VERSIONS_DEFINE]: JSON.stringify(first) },
    });
    expect(second).toEqual({
      a: hashWasmOutput(a, "a"),
      b: hashWasmOutput(b, "b"),
    });
  });
});

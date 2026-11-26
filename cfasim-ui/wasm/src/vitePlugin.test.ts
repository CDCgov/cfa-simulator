import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { EventEmitter } from "node:events";
import { execFile } from "node:child_process";
import {
  cfasimWasm,
  hashWasmOutput,
  WASM_VERSIONS_DEFINE,
} from "./vitePlugin.js";

vi.mock("node:child_process", () => ({ execFile: vi.fn() }));

let root: string;

function writeOutput(name: string, wasm: string, js: string) {
  const dir = resolve(root, "public", "wasm", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `${name}_bg.wasm`), wasm);
  writeFileSync(resolve(dir, `${name}.js`), js);
  return dir;
}

type ConfigResult = {
  define: Record<string, string>;
  server: { watch: { ignored: string[] } };
};
const runConfig = (
  plugin: ReturnType<typeof cfasimWasm>,
  userConfig: Record<string, unknown>,
) => (plugin.config as (c: unknown) => Promise<ConfigResult>)(userConfig);

function makeServer() {
  return {
    config: {
      root,
      publicDir: resolve(root, "public"),
      build: { outDir: "../dist" },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    },
    watcher: Object.assign(new EventEmitter(), { add: vi.fn() }),
    hot: { send: vi.fn() },
    httpServer: new EventEmitter(),
    close: vi.fn(),
  };
}

beforeEach(() => {
  root = mkdtempSync(resolve(tmpdir(), "cfasim-wasm-"));
  vi.mocked(execFile).mockReset();
  vi.mocked(execFile).mockImplementation(((
    _f: string,
    _a: string[],
    _o: unknown,
    cb: (err: null, out: string, errOut: string) => void,
  ) => cb(null, "", "")) as unknown as typeof execFile);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  rmSync(root, { recursive: true, force: true });
});

describe("cfasimWasm", () => {
  it("hashes output, runs wasm-pack, merges version maps, and rejects disabled publicDir", async () => {
    const dirA = writeOutput("my_sim", "wasm-a", "js-a");
    const hashA = hashWasmOutput(dirA, "my_sim");
    writeOutput("my_sim", "wasm-b", "js-a");
    const hashB = hashWasmOutput(dirA, "my_sim");
    expect(hashB).not.toBe(hashA);

    const first = await runConfig(cfasimWasm({ model: "..", name: "my-sim" }), {
      root,
    });
    expect(JSON.parse(first.define[WASM_VERSIONS_DEFINE])).toEqual({
      my_sim: hashB,
    });
    expect(first.server.watch.ignored).toEqual([
      `${resolve(root, "..", "target")}/**`,
    ]);
    expect(vi.mocked(execFile).mock.calls[0].slice(0, 2)).toEqual([
      "wasm-pack",
      ["build", "..", "--target", "web", "--out-dir", dirA],
    ]);

    const dirB = writeOutput("other", "w", "j");
    const merged = await runConfig(cfasimWasm({ name: "other" }), {
      root,
      define: { [WASM_VERSIONS_DEFINE]: first.define[WASM_VERSIONS_DEFINE] },
    });
    expect(JSON.parse(merged.define[WASM_VERSIONS_DEFINE])).toEqual({
      my_sim: hashB,
      other: hashWasmOutput(dirB, "other"),
    });
    await expect(
      runConfig(cfasimWasm({ name: "other" }), { root, publicDir: false }),
    ).rejects.toThrow("publicDir");
  });

  it("watches src and Cargo.toml, rebuilds on change, and respects watch: false", async () => {
    writeOutput("my_sim", "wasm", "js");
    const server = makeServer();
    (
      cfasimWasm({ model: "..", name: "my-sim" }).configureServer as (
        s: unknown,
      ) => void
    )(server);
    expect(server.watcher.add).toHaveBeenCalledWith([
      resolve(root, "..", "src"),
      resolve(root, "..", "Cargo.toml"),
    ]);

    server.watcher.emit("change", resolve(root, "..", "target", "debug", "x"));
    server.watcher.emit("change", resolve(root, "..", "src", "lib.rs"));
    await vi.advanceTimersByTimeAsync(100);
    expect(vi.mocked(execFile)).toHaveBeenCalledTimes(1);
    expect(server.hot.send).toHaveBeenCalledWith({
      type: "full-reload",
      path: "*",
    });

    const offServer = makeServer();
    (
      cfasimWasm({ model: "..", watch: false }).configureServer as (
        s: unknown,
      ) => void
    )(offServer);
    expect(offServer.watcher.add).not.toHaveBeenCalled();
  });
});

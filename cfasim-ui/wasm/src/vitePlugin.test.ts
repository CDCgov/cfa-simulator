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

function writeOutput(
  name: string,
  wasm: string,
  js: string,
  publicDir = "public",
) {
  const dir = resolve(root, publicDir, "wasm", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `${name}_bg.wasm`), wasm);
  writeFileSync(resolve(dir, `${name}.js`), js);
  return dir;
}

type ConfigResult = {
  define: Record<string, string>;
  server: { watch: { ignored: string[] } };
};

async function runConfig(
  plugin: ReturnType<typeof cfasimWasm>,
  userConfig: Record<string, unknown>,
): Promise<ConfigResult> {
  const hook = plugin.config as (c: unknown) => Promise<ConfigResult>;
  return hook(userConfig);
}

async function versionsOf(
  plugin: ReturnType<typeof cfasimWasm>,
  userConfig: Record<string, unknown>,
): Promise<Record<string, string>> {
  return JSON.parse(
    (await runConfig(plugin, userConfig)).define[WASM_VERSIONS_DEFINE],
  );
}

function calls(): string[][] {
  return vi
    .mocked(execFile)
    .mock.calls.map(([file, args]) => [file as string, ...(args as string[])]);
}

function makeServer() {
  const watcher = Object.assign(new EventEmitter(), { add: vi.fn() });
  return {
    config: {
      root,
      publicDir: resolve(root, "public"),
      build: { outDir: "../dist" },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    },
    watcher,
    hot: { send: vi.fn() },
    httpServer: new EventEmitter(),
    close: vi.fn(),
  };
}

function configureServer(
  plugin: ReturnType<typeof cfasimWasm>,
  server: ReturnType<typeof makeServer>,
) {
  (plugin.configureServer as (s: unknown) => void)(server);
}

beforeEach(() => {
  root = mkdtempSync(resolve(tmpdir(), "cfasim-wasm-"));
  vi.mocked(execFile).mockReset();
  vi.mocked(execFile).mockImplementation(((
    _file: string,
    _args: string[],
    _opts: unknown,
    cb: (err: null, stdout: string, stderr: string) => void,
  ) => cb(null, "", "")) as unknown as typeof execFile);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
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
  it("builds with wasm-pack, defines the output hash by model name and hides target/ from Vite's watcher", async () => {
    const dir = writeOutput("my_sim", "wasm", "js");
    const result = await runConfig(
      cfasimWasm({ model: "..", name: "my-sim" }),
      {
        root,
      },
    );
    expect(JSON.parse(result.define[WASM_VERSIONS_DEFINE])).toEqual({
      my_sim: hashWasmOutput(dir, "my_sim"),
    });
    expect(calls()).toEqual([
      ["wasm-pack", "build", "..", "--target", "web", "--out-dir", dir],
    ]);
    expect(vi.mocked(execFile).mock.calls[0][2]).toMatchObject({ cwd: root });
    expect(result.server.watch.ignored).toEqual([
      `${resolve(root, "..", "target")}/**`,
    ]);
  });

  it("builds into a custom publicDir and refuses a disabled one", async () => {
    const dir = writeOutput("m", "wasm", "js", "static");
    const versions = await versionsOf(cfasimWasm({ name: "m" }), {
      root,
      publicDir: "static",
    });
    expect(versions).toEqual({ m: hashWasmOutput(dir, "m") });
    expect(calls()[0]).toContain(dir);
    await expect(
      runConfig(cfasimWasm({ name: "m" }), { root, publicDir: false }),
    ).rejects.toThrow("cfasim-wasm: Vite's publicDir is disabled");
  });

  it("merges into a versions map defined by an earlier instance", async () => {
    const a = writeOutput("a", "wasm-a", "js-a");
    const b = writeOutput("b", "wasm-b", "js-b");
    const first = await versionsOf(cfasimWasm({ name: "a" }), { root });
    const second = await versionsOf(cfasimWasm({ name: "b" }), {
      root,
      define: { [WASM_VERSIONS_DEFINE]: JSON.stringify(first) },
    });
    expect(second).toEqual({
      a: hashWasmOutput(a, "a"),
      b: hashWasmOutput(b, "b"),
    });
  });

  it("watches the crate's src and Cargo.toml and rebuilds with the same command", async () => {
    const dir = writeOutput("my_sim", "wasm", "js");
    const plugin = cfasimWasm({ model: "..", name: "my-sim" });
    const server = makeServer();
    configureServer(plugin, server);
    expect(server.watcher.add).toHaveBeenCalledWith([
      resolve(root, "..", "src"),
      resolve(root, "..", "Cargo.toml"),
    ]);

    // The crate's own target/ is excluded, so cargo's writes never retrigger.
    server.watcher.emit("change", resolve(root, "..", "target", "debug", "x"));
    server.watcher.emit("change", resolve(root, "..", "src", "lib.rs"));
    await vi.advanceTimersByTimeAsync(100);
    expect(calls()).toEqual([
      ["wasm-pack", "build", "..", "--target", "web", "--out-dir", dir],
    ]);
    expect(vi.mocked(execFile).mock.calls[0][2]).toMatchObject({ cwd: root });
    expect(server.hot.send).toHaveBeenCalledWith({
      type: "full-reload",
      path: "*",
    });
  });

  it("adds extra watch paths and can be switched off", () => {
    const extra = cfasimWasm({
      model: "..",
      watch: ["../../shared-crate/src"],
    });
    const server = makeServer();
    configureServer(extra, server);
    expect(server.watcher.add).toHaveBeenCalledWith([
      resolve(root, "..", "src"),
      resolve(root, "..", "Cargo.toml"),
      resolve(root, "..", "..", "shared-crate", "src"),
    ]);

    const off = cfasimWasm({ model: "..", watch: false });
    const offServer = makeServer();
    configureServer(off, offServer);
    expect(offServer.watcher.add).not.toHaveBeenCalled();
  });
});

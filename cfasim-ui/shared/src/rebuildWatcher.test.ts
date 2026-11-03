import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { resolve } from "node:path";
import {
  execFileAsync,
  ignoreGlob,
  isWatchedFile,
  resolvePublicDir,
  resolveRoot,
  watchAndRebuild,
  watchModel,
} from "./rebuildWatcher.js";

const root = resolve("/proj/interactive");
const paths = [resolve("/proj/src"), resolve("/proj/Cargo.toml")];

describe("isWatchedFile", () => {
  it("accepts files under a watched directory and the watched files", () => {
    expect(isWatchedFile("/proj/src/lib.rs", paths)).toBe(true);
    expect(isWatchedFile("/proj/src/nested/data.csv", paths)).toBe(true);
    expect(isWatchedFile("/proj/Cargo.toml", paths)).toBe(true);
  });

  it("rejects files outside the watched paths", () => {
    expect(isWatchedFile("/proj/Cargo.lock", paths)).toBe(false);
    expect(isWatchedFile("/proj/srcs/lib.rs", paths)).toBe(false);
    expect(isWatchedFile("/proj/interactive/src/App.vue", paths)).toBe(false);
  });

  it("rejects editor noise and never-source segments inside the tree", () => {
    expect(isWatchedFile("/proj/src/.lib.rs.swp", paths)).toBe(false);
    expect(isWatchedFile("/proj/src/lib.rs~", paths)).toBe(false);
    expect(isWatchedFile("/proj/src/pkg.egg-info/PKG-INFO", paths)).toBe(false);
    expect(isWatchedFile("/proj/src/pkg/__pycache__/m.pyc", paths)).toBe(false);
    expect(isWatchedFile("/proj/src/node_modules/x/i.js", paths)).toBe(false);
  });

  it("keeps modules named like build directories", () => {
    expect(isWatchedFile("/proj/src/target/mod.rs", paths)).toBe(true);
    expect(isWatchedFile("/proj/src/build/mod.rs", paths)).toBe(true);
  });

  it("rejects excluded directories and lets overlapping roots each match", () => {
    const whole = [resolve("/proj")];
    const exclude = [resolve("/proj/target")];
    expect(isWatchedFile("/proj/target/debug/x", whole, exclude)).toBe(false);
    expect(isWatchedFile("/proj/src/lib.rs", whole, exclude)).toBe(true);
    const overlapping = [resolve("/proj"), resolve("/proj/.hidden/tools")];
    expect(isWatchedFile("/proj/.hidden/tools/gen.py", overlapping)).toBe(true);
    expect(isWatchedFile("/proj/.hidden/other.py", overlapping)).toBe(false);
  });
});

describe("resolveRoot / resolvePublicDir / ignoreGlob", () => {
  it("mirrors Vite's root and publicDir resolution and rejects a disabled publicDir", () => {
    expect(resolveRoot({ root: "interactive" })).toBe(resolve("interactive"));
    expect(resolveRoot({})).toBe(process.cwd());
    expect(resolvePublicDir(root, "static", "p")).toBe(resolve(root, "static"));
    expect(resolvePublicDir(root, resolve(root, "static"), "p")).toBe(
      resolve(root, "static"),
    );
    expect(resolvePublicDir(root, undefined, "p")).toBe(
      resolve(root, "public"),
    );
    expect(() => resolvePublicDir(root, false, "p")).toThrow(
      "p: Vite's publicDir is disabled",
    );
    expect(() => resolvePublicDir(root, "", "p")).toThrow("publicDir");
    expect(ignoreGlob("/proj/target")).toBe(`${resolve("/proj/target")}/**`);
  });
});

describe("execFileAsync", () => {
  it("resolves on exit 0 and rejects with the command line and stderr otherwise", async () => {
    await expect(execFileAsync("true", [], "/")).resolves.toBeUndefined();
    await expect(
      execFileAsync("sh", ["-c", "echo oops >&2; exit 1"], "/"),
    ).rejects.toThrow("sh -c echo oops >&2; exit 1\noops");
  });
});

function makeServer() {
  const watcher = Object.assign(new EventEmitter(), { add: vi.fn() });
  const httpServer = new EventEmitter();
  return {
    config: {
      root,
      publicDir: resolve(root, "public"),
      build: { outDir: "../dist" },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    },
    watcher,
    hot: { send: vi.fn() },
    httpServer,
    close: vi.fn().mockResolvedValue(undefined),
  };
}

const reload = { type: "full-reload", path: "*" };

describe("watchAndRebuild", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("adds the paths to the watcher and rebuilds once per burst of changes", async () => {
    const server = makeServer();
    const build = vi.fn().mockResolvedValue(undefined);
    watchAndRebuild(server, { name: "p", paths, build });
    expect(server.watcher.add).toHaveBeenCalledWith(paths);
    // Neither fake path exists, which is reported rather than silently watched.
    expect(server.config.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`p: ${paths[0]} does not exist`),
      { timestamp: true },
    );

    server.watcher.emit("change", "/proj/src/lib.rs");
    server.watcher.emit("add", "/proj/src/model.rs");
    server.watcher.emit("unlink", "/proj/src/old.rs");
    expect(build).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(build).toHaveBeenCalledTimes(1);
    expect(server.hot.send).toHaveBeenCalledWith(reload);
    expect(server.config.logger.info).toHaveBeenCalledWith(
      expect.stringMatching(/^p: rebuilt in \d+\.\ds, reloading$/),
      { timestamp: true },
    );
  });

  it("ignores changes outside the watched paths, in excludes and in Vite's outDir", async () => {
    const server = makeServer();
    const build = vi.fn().mockResolvedValue(undefined);
    watchAndRebuild(server, {
      name: "p",
      paths: [resolve("/proj")],
      exclude: [resolve("/proj/target")],
      build,
    });
    server.watcher.emit("change", "/elsewhere/lib.rs");
    server.watcher.emit("change", "/proj/src/pkg.egg-info/PKG-INFO");
    server.watcher.emit("change", "/proj/target/debug/lib.rlib");
    server.watcher.emit("change", "/proj/dist/index.html");
    await vi.advanceTimersByTimeAsync(100);
    expect(build).not.toHaveBeenCalled();
  });

  it("re-arms the debounce for changes that land mid-build", async () => {
    const server = makeServer();
    let finish!: () => void;
    const build = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((r) => (finish = r)))
      .mockResolvedValue(undefined);
    watchAndRebuild(server, { name: "p", paths, build });

    server.watcher.emit("change", "/proj/src/lib.rs");
    await vi.advanceTimersByTimeAsync(100);
    expect(build).toHaveBeenCalledTimes(1);
    server.watcher.emit("change", "/proj/src/lib.rs");
    server.watcher.emit("change", "/proj/src/model.rs");
    await vi.advanceTimersByTimeAsync(100);
    expect(build).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(0);
    // The queued build waits out the debounce instead of starting at once.
    expect(build).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(build).toHaveBeenCalledTimes(2);
    expect(server.hot.send).toHaveBeenCalledTimes(2);
  });

  it("waits for the watcher to report files the build created before reloading", async () => {
    const server = makeServer();
    const created = resolve(root, "public", "m-0.2.0.whl");
    const build = vi.fn().mockResolvedValue([created]);
    watchAndRebuild(server, { name: "p", paths, build });
    server.watcher.emit("change", "/proj/src/lib.rs");
    await vi.advanceTimersByTimeAsync(100);
    expect(build).toHaveBeenCalledTimes(1);
    expect(server.hot.send).not.toHaveBeenCalled();
    server.watcher.emit("add", created);
    await vi.advanceTimersByTimeAsync(0);
    expect(server.hot.send).toHaveBeenCalledWith(reload);

    // An add reported while the build was still running counts too.
    const server2 = makeServer();
    const early = vi.fn().mockImplementation(async () => {
      server2.watcher.emit("add", created);
      return [created];
    });
    watchAndRebuild(server2, { name: "p", paths, build: early });
    server2.watcher.emit("change", "/proj/src/lib.rs");
    await vi.advanceTimersByTimeAsync(100);
    expect(server2.hot.send).toHaveBeenCalledWith(reload);

    // Without the event the reload goes out after the timeout, with a warning.
    const server3 = makeServer();
    watchAndRebuild(server3, { name: "p", paths, build });
    server3.watcher.emit("change", "/proj/src/lib.rs");
    await vi.advanceTimersByTimeAsync(100);
    expect(server3.hot.send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(server3.hot.send).toHaveBeenCalledWith(reload);
    expect(server3.config.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("did not report"),
      { timestamp: true },
    );
  });

  it("drops a pending build, and a finished one's reload, once the server closes", async () => {
    const server = makeServer();
    let finish!: () => void;
    const build = vi
      .fn()
      .mockImplementation(() => new Promise<void>((r) => (finish = r)));
    watchAndRebuild(server, { name: "p", paths, build });
    server.watcher.emit("change", "/proj/src/lib.rs");
    await vi.advanceTimersByTimeAsync(100);
    expect(build).toHaveBeenCalledTimes(1);
    server.watcher.emit("change", "/proj/src/lib.rs");
    server.httpServer.emit("close");
    finish();
    await vi.advanceTimersByTimeAsync(200);
    expect(build).toHaveBeenCalledTimes(1);
    expect(server.hot.send).not.toHaveBeenCalled();

    // Middleware mode has no httpServer; server.close() covers it.
    const pending = makeServer();
    const innerClose = pending.close;
    const build2 = vi.fn().mockResolvedValue(undefined);
    watchAndRebuild(pending, { name: "p", paths, build: build2 });
    pending.watcher.emit("change", "/proj/src/lib.rs");
    await pending.close();
    expect(innerClose).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(build2).not.toHaveBeenCalled();
  });

  it("logs a failed build and shows it in the error overlay", async () => {
    const server = makeServer();
    const build = vi
      .fn()
      .mockRejectedValue(new Error("error[E0308]: mismatched types"));
    watchAndRebuild(server, { name: "p", paths, build });
    server.watcher.emit("change", "/proj/src/lib.rs");
    await vi.advanceTimersByTimeAsync(100);
    expect(server.config.logger.error).toHaveBeenCalledWith(
      "p: build failed\nerror[E0308]: mismatched types",
      { timestamp: true },
    );
    expect(server.hot.send).toHaveBeenCalledWith({
      type: "error",
      err: {
        message: "p: build failed\n\nerror[E0308]: mismatched types",
        stack: "",
        plugin: "p",
      },
    });
    expect(server.hot.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "full-reload" }),
    );
  });
});

describe("watchModel", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("watches src/ and the manifest under the model dir plus extras, excluding the outputs", async () => {
    const server = makeServer();
    const build = vi.fn().mockResolvedValue(undefined);
    watchModel(server, {
      name: "p",
      model: "..",
      manifest: "Cargo.toml",
      watch: ["../../dep/src"],
      outputs: ["target"],
      publicDir: resolve(root, "public"),
      build,
    });
    expect(server.watcher.add).toHaveBeenCalledWith([
      resolve("/proj/src"),
      resolve("/proj/Cargo.toml"),
      resolve("/dep/src"),
    ]);
    server.watcher.emit("change", "/proj/target/debug/x");
    server.watcher.emit("change", "/proj/interactive/public/wasm/m/m.js");
    await vi.advanceTimersByTimeAsync(100);
    expect(build).not.toHaveBeenCalled();
    server.watcher.emit("change", "/dep/src/lib.rs");
    await vi.advanceTimersByTimeAsync(100);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("does nothing when watch is false", () => {
    const server = makeServer();
    watchModel(server, {
      name: "p",
      model: "..",
      manifest: "Cargo.toml",
      watch: false,
      outputs: [],
      publicDir: resolve(root, "public"),
      build: vi.fn(),
    });
    expect(server.watcher.add).not.toHaveBeenCalled();
  });
});

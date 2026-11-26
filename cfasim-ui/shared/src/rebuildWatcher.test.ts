import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { resolve } from "node:path";
import {
  isWatchedFile,
  resolvePublicDir,
  watchAndRebuild,
  watchModel,
} from "./rebuildWatcher.js";

const root = resolve("/proj/interactive");
const paths = [resolve("/proj/src"), resolve("/proj/Cargo.toml")];
const reload = { type: "full-reload", path: "*" };

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
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe("rebuildWatcher", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("filters watched paths, noise, excludes, and disabled publicDir", () => {
    expect(isWatchedFile("/proj/src/lib.rs", paths)).toBe(true);
    expect(isWatchedFile("/proj/srcs/lib.rs", paths)).toBe(false);
    expect(isWatchedFile("/proj/src/.lib.rs.swp", paths)).toBe(false);
    expect(isWatchedFile("/proj/src/pkg/__pycache__/m.pyc", paths)).toBe(false);
    expect(
      isWatchedFile(
        "/proj/target/debug/x",
        [resolve("/proj")],
        [resolve("/proj/target")],
      ),
    ).toBe(false);
    expect(() => resolvePublicDir(root, false, "p")).toThrow("publicDir");
  });

  it("debounces bursts and re-arms debounce for mid-build changes", async () => {
    const server = makeServer();
    let finish!: () => void;
    const build = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((res) => (finish = res)))
      .mockResolvedValue(undefined);
    watchAndRebuild(server, { name: "p", paths, build });

    server.watcher.emit("change", "/proj/src/lib.rs");
    server.watcher.emit("add", "/proj/src/model.rs");
    server.watcher.emit("change", "/proj/dist/index.html");
    await vi.advanceTimersByTimeAsync(100);
    expect(build).toHaveBeenCalledTimes(1);

    server.watcher.emit("change", "/proj/src/model.rs");
    await vi.advanceTimersByTimeAsync(100);
    expect(build).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(build).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(build).toHaveBeenCalledTimes(2);
    expect(server.hot.send).toHaveBeenCalledTimes(2);
  });

  it("recovers from errors, waits for created files, and drops work on close", async () => {
    const server = makeServer();
    const created = resolve(root, "public", "m-0.2.0.whl");
    const build = vi
      .fn()
      .mockRejectedValueOnce(new Error("compile error"))
      .mockResolvedValueOnce([created]);
    watchAndRebuild(server, { name: "p", paths, build });

    server.watcher.emit("change", "/proj/src/lib.rs");
    await vi.advanceTimersByTimeAsync(100);
    expect(server.hot.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );

    server.watcher.emit("change", "/proj/src/lib.rs");
    await vi.advanceTimersByTimeAsync(100);
    expect(server.hot.send).toHaveBeenCalledTimes(1);
    server.watcher.emit("add", created);
    await vi.advanceTimersByTimeAsync(0);
    expect(server.hot.send).toHaveBeenLastCalledWith(reload);

    server.watcher.emit("change", "/proj/src/lib.rs");
    server.httpServer.emit("close");
    await vi.advanceTimersByTimeAsync(100);
    expect(build).toHaveBeenCalledTimes(2);

    const quiet = makeServer();
    watchModel(quiet, {
      name: "p",
      model: "..",
      manifest: "Cargo.toml",
      watch: false,
      outputs: [],
      publicDir: resolve(root, "public"),
      build: vi.fn(),
    });
    expect(quiet.watcher.add).not.toHaveBeenCalled();
  });
});

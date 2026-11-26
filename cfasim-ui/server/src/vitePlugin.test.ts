import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { cfasimServer, fallbackCommand, serverCommand } from "./vitePlugin.js";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

class FakeChild extends EventEmitter {
  pid = 4242;
  exitCode: number | null = null;
  signalCode: string | null = null;
}

const processKill = vi.spyOn(process, "kill").mockImplementation(() => true);

function fakeServer(listening = true) {
  return {
    httpServer: Object.assign(new EventEmitter(), {
      listening,
      address: () => ({ port: 5173 }),
    }),
    config: {
      base: "/",
      server: {},
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    },
  };
}

beforeEach(() => {
  vi.mocked(spawn).mockReset();
  processKill.mockClear();
  (globalThis as unknown as Record<symbol, Map<number, unknown> | undefined>)[
    Symbol.for("cfasim-server.stopping")
  ]?.clear();
});

describe("cfasimServer", () => {
  it("builds commands and proxies /api, spawns detached, and cleans up on close", () => {
    expect(
      serverCommand({ port: 9000, csv: true, tasks: "pkg.tasks" }),
    ).toEqual([
      "cfasim",
      "serve",
      "--port",
      "9000",
      "--output",
      "output",
      "--csv",
      "--tasks",
      "pkg.tasks",
    ]);
    expect(serverCommand({ command: ["cargo", "run"], port: 1 })).toEqual([
      "cargo",
      "run",
    ]);
    expect(fallbackCommand({ port: 1 }, "http://x/")?.[0]).toBe("uvx");
    vi.stubEnv("CFASIM_BIN", "/tmp/cfasim");
    expect(serverCommand()[0]).toBe("/tmp/cfasim");
    expect(fallbackCommand()).toBeUndefined();
    vi.unstubAllEnvs();

    const child = new FakeChild();
    vi.mocked(spawn).mockReturnValue(child as never);
    const plugin = cfasimServer({ port: 9100, tasks: "demo.tasks", cwd: "/p" });
    expect(plugin.apply).toBe("serve");
    expect((plugin.config as () => Record<string, unknown>)()).toEqual({
      server: { proxy: { "/api": { target: "http://127.0.0.1:9100" } } },
    });

    const server = fakeServer();
    (plugin.configureServer as (s: unknown) => void)(server);
    expect(spawn).toHaveBeenCalledWith(
      "cfasim",
      expect.arrayContaining([
        "--port",
        "9100",
        "--app-url",
        "http://localhost:5173/",
      ]),
      { cwd: "/p", stdio: "inherit", detached: true },
    );
    server.httpServer.emit("close");
    expect(processKill).toHaveBeenCalledWith(-4242, "SIGTERM");
    child.emit("exit", 1, null);
    expect(server.config.logger.error).not.toHaveBeenCalled();
  });

  it("waits on restart, skips early close, falls back to uvx, and logs unexpected exit", async () => {
    const oldChild = new FakeChild();
    const nextChild = new FakeChild();
    const uvxChild = new FakeChild();
    vi.mocked(spawn)
      .mockReturnValueOnce(oldChild as never)
      .mockReturnValueOnce(nextChild as never)
      .mockReturnValueOnce(uvxChild as never);

    const first = fakeServer();
    (cfasimServer({ port: 9200 }).configureServer as (s: unknown) => void)(
      first,
    );
    first.httpServer.emit("close");
    const second = fakeServer();
    (cfasimServer({ port: 9200 }).configureServer as (s: unknown) => void)(
      second,
    );
    expect(spawn).toHaveBeenCalledTimes(1);
    oldChild.exitCode = 0;
    oldChild.emit("exit", 0, null);
    await Promise.resolve();
    await Promise.resolve();
    expect(spawn).toHaveBeenCalledTimes(2);

    nextChild.emit(
      "error",
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );
    expect(vi.mocked(spawn).mock.calls[2][0]).toBe("uvx");
    uvxChild.emit("exit", 1, null);
    expect(second.config.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("port 9200"),
    );
    second.httpServer.emit("close");

    vi.mocked(spawn).mockClear();
    const unready = fakeServer(false);
    (cfasimServer().configureServer as (s: unknown) => void)(unready);
    unready.httpServer.emit("close");
    unready.httpServer.emit("listening");
    expect(spawn).not.toHaveBeenCalled();
  });
});

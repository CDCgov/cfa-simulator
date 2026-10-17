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
  const httpServer = Object.assign(new EventEmitter(), {
    listening,
    address: () => ({ port: 5173 }),
  });
  return {
    httpServer,
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
  // Fake children never exit, so forget servers earlier tests stopped.
  (globalThis as unknown as Record<symbol, Map<number, unknown> | undefined>)[
    Symbol.for("cfasim-server.stopping")
  ]?.clear();
});

describe("serverCommand", () => {
  it("builds the default cfasim serve command", () => {
    expect(serverCommand()).toEqual([
      "cfasim",
      "serve",
      "--port",
      "8765",
      "--output",
      "output",
    ]);
    expect(
      serverCommand({
        port: 9000,
        output: "runs",
        csv: true,
        debug: true,
        tasks: "pkg.tasks",
      }),
    ).toEqual([
      "cfasim",
      "serve",
      "--port",
      "9000",
      "--output",
      "runs",
      "--csv",
      "--debug",
      "--tasks",
      "pkg.tasks",
    ]);
  });

  it("takes the executable from the option or CFASIM_BIN", () => {
    expect(serverCommand({ bin: "/opt/cfasim" })[0]).toBe("/opt/cfasim");
    vi.stubEnv("CFASIM_BIN", "/tmp/cfasim");
    expect(serverCommand()[0]).toBe("/tmp/cfasim");
    expect(fallbackCommand()).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it("uses an explicit command verbatim", () => {
    expect(
      serverCommand({ command: ["cargo", "run"], port: 1 }, "http://x/"),
    ).toEqual(["cargo", "run"]);
    expect(fallbackCommand({ command: ["cargo", "run"] })).toBeUndefined();
  });

  it("falls back to the matching release through uvx", () => {
    const fallback = fallbackCommand({ port: 1 }, "http://x/");
    expect(fallback?.[0]).toBe("uvx");
    expect(fallback?.[1]).toMatch(/^cfasim@\d+\.\d+\.\d+/);
    expect(fallback?.slice(2)).toEqual([
      "serve",
      "--port",
      "1",
      "--output",
      "output",
      "--app-url",
      "http://x/",
    ]);
    expect(fallbackCommand({ bin: "cfasim" })).toBeUndefined();
  });
});

describe("cfasimServer", () => {
  it("only applies to the dev server and proxies the api path", () => {
    const plugin = cfasimServer({ port: 9100 });
    expect(plugin.apply).toBe("serve");
    const config = (plugin.config as () => Record<string, unknown>)();
    expect(config).toEqual({
      server: {
        proxy: { "/api": { target: "http://127.0.0.1:9100" } },
      },
    });
  });

  it("waits for the previous server to exit after a vite restart", async () => {
    const old = new FakeChild();
    const next = new FakeChild();
    vi.mocked(spawn)
      .mockReturnValueOnce(old as never)
      .mockReturnValueOnce(next as never);
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
    old.exitCode = 0;
    old.emit("exit", 0, null);
    await Promise.resolve();
    await Promise.resolve();
    expect(spawn).toHaveBeenCalledTimes(2);
    second.httpServer.emit("close");
    next.emit("exit", 0, null);
  });

  it("spawns the server with stdio inherited and stops it when vite closes", () => {
    const child = new FakeChild();
    vi.mocked(spawn).mockReturnValue(child as never);
    const plugin = cfasimServer({ tasks: "demo.tasks", cwd: "/proj" });
    const server = fakeServer();
    (plugin.configureServer as (s: unknown) => void)(server);
    expect(spawn).toHaveBeenCalledWith(
      "cfasim",
      [
        "serve",
        "--port",
        "8765",
        "--output",
        "output",
        "--tasks",
        "demo.tasks",
        "--app-url",
        "http://localhost:5173/",
      ],
      { cwd: "/proj", stdio: "inherit", detached: true },
    );
    server.httpServer.emit("close");
    // The whole process group is signalled, not just the launcher.
    expect(processKill).toHaveBeenCalledWith(-4242, "SIGTERM");
    // A non-zero exit after we asked it to stop is not an error.
    child.emit("exit", 1, null);
    expect(server.config.logger.error).not.toHaveBeenCalled();
  });

  it("waits for vite's port before starting, and skips the start if vite closed first", () => {
    const child = new FakeChild();
    vi.mocked(spawn).mockReturnValue(child as never);
    const plugin = cfasimServer();
    const server = fakeServer(false);
    server.config.base = "/app/";
    server.config.server = { https: {} };
    (plugin.configureServer as (s: unknown) => void)(server);
    expect(spawn).not.toHaveBeenCalled();
    server.httpServer.emit("listening");
    expect(vi.mocked(spawn).mock.calls[0][1]).toContain(
      "https://localhost:5173/app/",
    );
    server.httpServer.emit("close");

    vi.mocked(spawn).mockClear();
    const closedEarly = fakeServer(false);
    (plugin.configureServer as (s: unknown) => void)(closedEarly);
    closedEarly.httpServer.emit("close");
    closedEarly.httpServer.emit("listening");
    expect(spawn).not.toHaveBeenCalled();
  });

  it("stops the server on Ctrl+C and lets the process exit", () => {
    const child = new FakeChild();
    vi.mocked(spawn).mockReturnValue(child as never);
    const once = vi.spyOn(process, "once");
    const plugin = cfasimServer();
    (plugin.configureServer as (s: unknown) => void)(fakeServer());
    const sigint = once.mock.calls.find(([event]) => event === "SIGINT");
    expect(sigint).toBeDefined();
    (sigint![1] as (sig: string) => void)("SIGINT");
    expect(processKill).toHaveBeenCalledWith(-4242, "SIGTERM");
    // Node's default exit was suppressed by listening; the signal is handed back.
    expect(processKill).toHaveBeenCalledWith(process.pid, "SIGINT");
    const sigterm = once.mock.calls.find(([event]) => event === "SIGTERM");
    (sigterm![1] as (sig: string) => void)("SIGTERM");
    // SIGTERM is left to Vite's own handler.
    expect(processKill).not.toHaveBeenCalledWith(process.pid, "SIGTERM");
    once.mockRestore();
  });

  it("retries through uvx when cfasim is not installed", () => {
    const missing = new FakeChild();
    const viaUvx = new FakeChild();
    vi.mocked(spawn)
      .mockReturnValueOnce(missing as never)
      .mockReturnValueOnce(viaUvx as never);
    const plugin = cfasimServer();
    const server = fakeServer();
    (plugin.configureServer as (s: unknown) => void)(server);
    const enoent = Object.assign(new Error("spawn cfasim ENOENT"), {
      code: "ENOENT",
    });
    missing.emit("error", enoent);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(vi.mocked(spawn).mock.calls[1][0]).toBe("uvx");
    expect(server.config.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("not installed"),
    );
    expect(server.config.logger.error).not.toHaveBeenCalled();
    // The second launcher is what gets stopped.
    server.httpServer.emit("close");
    expect(processKill).toHaveBeenCalledWith(-4242, "SIGTERM");

    // A failure of the fallback itself is reported with an install hint.
    viaUvx.emit("error", enoent);
    expect(server.config.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("cargo install cfasim"),
    );
  });

  it("reports an unexpected exit with a port hint", () => {
    const child = new FakeChild();
    vi.mocked(spawn).mockReturnValue(child as never);
    const plugin = cfasimServer({ port: 8765 });
    const server = fakeServer();
    (plugin.configureServer as (s: unknown) => void)(server);
    child.emit("exit", 1, null);
    expect(server.config.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("port 8765"),
    );
    server.httpServer.emit("close");
  });
});

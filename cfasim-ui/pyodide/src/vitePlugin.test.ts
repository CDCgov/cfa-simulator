import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { cfasimPyodide } from "./vitePlugin.js";

vi.mock("node:child_process", () => ({ execFile: vi.fn() }));

let root: string;
let publicDir: string;
let modelWheel = "my_model-0.1.0-py3-none-any.whl";

function fakeBuild(_file: string, args: string[]) {
  const download = args.includes("download");
  const outDir = args[args.indexOf(download ? "--dest" : "--out-dir") + 1];
  mkdirSync(outDir, { recursive: true });
  if (download)
    writeFileSync(
      resolve(outDir, "cfasim_model-1.0.0-py3-none-any.whl"),
      "dep",
    );
  else if (args[1] === "..")
    writeFileSync(resolve(outDir, modelWheel), "wheel");
}

const wheelsJson = (): string[] =>
  JSON.parse(readFileSync(resolve(publicDir, "wheels.json"), "utf8"));

function makeServer() {
  return {
    config: {
      root,
      publicDir,
      build: { outDir: "../dist" },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    },
    watcher: Object.assign(new EventEmitter(), { add: vi.fn() }),
    hot: { send: vi.fn() },
    httpServer: new EventEmitter(),
    close: vi.fn(),
  };
}

type Hooks = {
  configResolved: (config: {
    root: string;
    publicDir: string;
  }) => Promise<void>;
  configureServer: (server: ReturnType<typeof makeServer>) => void;
};

async function createPlugin(options: Parameters<typeof cfasimPyodide>[0]) {
  const hooks = cfasimPyodide(options) as unknown as Hooks;
  await hooks.configResolved({ root, publicDir });
  return hooks;
}

beforeEach(() => {
  root = mkdtempSync(resolve(tmpdir(), "cfasim-pyodide-"));
  publicDir = resolve(root, "static");
  modelWheel = "my_model-0.1.0-py3-none-any.whl";
  vi.mocked(execFile).mockReset();
  vi.mocked(execFile).mockImplementation(((
    file: string,
    args: string[],
    _opts: unknown,
    cb: (err: null, out: string, errOut: string) => void,
  ) => {
    fakeBuild(file, args);
    cb(null, "", "");
  }) as unknown as typeof execFile);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  rmSync(root, { recursive: true, force: true });
});

describe("cfasimPyodide", () => {
  it("builds wheels, writes manifests, and rejects disabled publicDir", async () => {
    await createPlugin({ model: "..", pypiDeps: ["cfasim-model"] });
    expect(wheelsJson().sort()).toEqual([
      "cfasim_model-1.0.0-py3-none-any.whl",
      "my_model-0.1.0-py3-none-any.whl",
    ]);
    expect(
      JSON.parse(
        readFileSync(resolve(publicDir, "pyodide-packages.json"), "utf8"),
      ),
    ).toEqual(["micropip", "numpy"]);
    const disabled = cfasimPyodide({ model: ".." }) as unknown as Hooks;
    await expect(
      disabled.configResolved({ root, publicDir: "" }),
    ).rejects.toThrow("publicDir");
  });

  it("rebuilds bumped model wheel, waits for watcher add, and respects watch: false", async () => {
    const hooks = await createPlugin({
      model: "..",
      pypiDeps: ["cfasim-model"],
    });
    const server = makeServer();
    hooks.configureServer(server);
    expect(server.watcher.add).toHaveBeenCalledWith([
      resolve(root, "..", "src"),
      resolve(root, "..", "pyproject.toml"),
    ]);

    modelWheel = "my_model-0.2.0-py3-none-any.whl";
    server.watcher.emit("change", resolve(root, "..", "build", "lib", "m.py"));
    server.watcher.emit("change", resolve(root, "..", "pyproject.toml"));
    await vi.advanceTimersByTimeAsync(100);
    expect(
      existsSync(resolve(publicDir, "my_model-0.1.0-py3-none-any.whl")),
    ).toBe(false);
    expect(wheelsJson().sort()).toEqual([
      "cfasim_model-1.0.0-py3-none-any.whl",
      "my_model-0.2.0-py3-none-any.whl",
    ]);
    expect(server.hot.send).not.toHaveBeenCalled();
    server.watcher.emit("add", resolve(publicDir, modelWheel));
    await vi.advanceTimersByTimeAsync(0);
    expect(server.hot.send).toHaveBeenCalledWith({
      type: "full-reload",
      path: "*",
    });

    const offServer = makeServer();
    (await createPlugin({ model: "..", watch: false })).configureServer(
      offServer,
    );
    expect(offServer.watcher.add).not.toHaveBeenCalled();
  });
});

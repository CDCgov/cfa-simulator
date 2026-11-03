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
// What the mocked `uv build` writes for the model, settable per test.
let modelWheel = "my_model-0.1.0-py3-none-any.whl";

// Writes what `uv build` / `pip download` would into the `--out-dir` /
// `--dest` directory named in the arguments.
function fakeBuild(_file: string, args: string[]) {
  const download = args.includes("download");
  const outDir = args[args.indexOf(download ? "--dest" : "--out-dir") + 1];
  mkdirSync(outDir, { recursive: true });
  if (download) {
    writeFileSync(
      resolve(outDir, "cfasim_model-1.0.0-py3-none-any.whl"),
      "dep",
    );
  } else if (args[1] === "..") {
    writeFileSync(resolve(outDir, modelWheel), "wheel");
  }
}

function calls(): string[][] {
  return vi
    .mocked(execFile)
    .mock.calls.map(([file, args]) => [file as string, ...(args as string[])]);
}

function wheelsJson(): string[] {
  return JSON.parse(readFileSync(resolve(publicDir, "wheels.json"), "utf8"));
}

function makeServer() {
  const watcher = Object.assign(new EventEmitter(), { add: vi.fn() });
  return {
    config: {
      root,
      publicDir,
      build: { outDir: "../dist" },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    },
    watcher,
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

async function plugin(
  options: Parameters<typeof cfasimPyodide>[0],
): Promise<Hooks> {
  const p = cfasimPyodide(options) as unknown as Hooks;
  await p.configResolved({ root, publicDir });
  return p;
}

const reload = { type: "full-reload", path: "*" };

beforeEach(() => {
  root = mkdtempSync(resolve(tmpdir(), "cfasim-pyodide-"));
  publicDir = resolve(root, "static");
  modelWheel = "my_model-0.1.0-py3-none-any.whl";
  vi.mocked(execFile).mockReset();
  vi.mocked(execFile).mockImplementation(((
    file: string,
    args: string[],
    _opts: unknown,
    cb: (err: null, stdout: string, stderr: string) => void,
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
  it("builds the deps and the model into publicDir and lists every wheel", async () => {
    await plugin({
      model: "..",
      pypiDeps: ["cfasim-model"],
      pipCommand: ["uv", "run", "--project", "my proj", "pip"],
    });
    expect(calls()).toEqual([
      [
        "uv",
        "run",
        "--project",
        "my proj",
        "pip",
        "download",
        "cfasim-model",
        "--dest",
        publicDir,
        "--no-deps",
        "--python-version",
        "3.12",
        "--platform",
        "any",
      ],
      ["uv", "build", "..", "--wheel", "--out-dir", publicDir],
    ]);
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
    ).rejects.toThrow("cfasim-pyodide: Vite's publicDir is disabled");
  });

  it("watches the model source and rebuilds only the model wheel", async () => {
    const p = await plugin({ model: "..", pypiDeps: ["cfasim-model"] });
    const server = makeServer();
    p.configureServer(server);
    expect(server.watcher.add).toHaveBeenCalledWith([
      resolve(root, "..", "src"),
      resolve(root, "..", "pyproject.toml"),
    ]);

    // setuptools' build/ and the egg-info it writes into src/ never retrigger.
    server.watcher.emit("change", resolve(root, "..", "build", "lib", "m.py"));
    server.watcher.emit(
      "change",
      resolve(root, "..", "src", "my_model.egg-info", "PKG-INFO"),
    );
    server.watcher.emit(
      "change",
      resolve(root, "..", "src", "my_model", "__init__.py"),
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(calls().slice(2)).toEqual([
      ["uv", "build", "..", "--wheel", "--out-dir", publicDir],
    ]);
    // Same wheel filename: nothing new for Vite's watcher to report.
    expect(server.hot.send).toHaveBeenCalledWith(reload);
    expect(wheelsJson().sort()).toEqual([
      "cfasim_model-1.0.0-py3-none-any.whl",
      "my_model-0.1.0-py3-none-any.whl",
    ]);
  });

  it("replaces the model wheel on a version bump once the watcher has reported it", async () => {
    const p = await plugin({ model: "..", pypiDeps: ["cfasim-model"] });
    const server = makeServer();
    p.configureServer(server);

    modelWheel = "my_model-0.2.0-py3-none-any.whl";
    server.watcher.emit("change", resolve(root, "..", "pyproject.toml"));
    await vi.advanceTimersByTimeAsync(100);
    expect(wheelsJson().sort()).toEqual([
      "cfasim_model-1.0.0-py3-none-any.whl",
      "my_model-0.2.0-py3-none-any.whl",
    ]);
    expect(
      existsSync(resolve(publicDir, "my_model-0.1.0-py3-none-any.whl")),
    ).toBe(false);
    // Vite only serves the new file once chokidar has reported it.
    expect(server.hot.send).not.toHaveBeenCalled();
    server.watcher.emit("add", resolve(publicDir, modelWheel));
    await vi.advanceTimersByTimeAsync(0);
    expect(server.hot.send).toHaveBeenCalledWith(reload);
  });

  it("adds extra watch paths and can be switched off", async () => {
    const server = makeServer();
    (await plugin({ model: "..", watch: ["../plugins"] })).configureServer(
      server,
    );
    expect(server.watcher.add).toHaveBeenCalledWith([
      resolve(root, "..", "src"),
      resolve(root, "..", "pyproject.toml"),
      resolve(root, "..", "plugins"),
    ]);

    const offServer = makeServer();
    (await plugin({ model: "..", watch: false })).configureServer(offServer);
    expect(offServer.watcher.add).not.toHaveBeenCalled();
  });
});

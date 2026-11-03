import { readdirSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import {
  execFileAsync,
  resolvePublicDir,
  watchModel,
} from "@cfasim-ui/shared/vite";

/**
 * @typedef {object} CfasimPyodideOptions
 * @property {string} [model] Path to the Python model directory (default: "model")
 * @property {string[]} [pypiDeps] PyPI packages to download at build time and serve locally
 * @property {string[]} [localDeps] Local package directories built into wheels (via `uv build`) and served alongside the model wheel. Lets a dependency resolve from a working tree instead of PyPI, e.g. cfasim's own e2e tests during a release window.
 * @property {string[]} [pyodidePackages] Pyodide built-in packages to preload in the worker (e.g. "scipy", "pandas"). See https://pyodide.org/en/stable/usage/packages-in-pyodide.html. `micropip` and `numpy` are always included.
 * @property {string | string[]} [pipCommand] Command used to invoke pip for downloading `pypiDeps` (default: "uvx pip"). Run without a shell, so `~`, `$VAR` and quotes are not expanded: a string is split on whitespace, and an argument with spaces needs the array form, e.g. `["uv", "run", "--project", "my proj", "pip"]`.
 * @property {string} [pythonVersion] Python version passed to pip's --python-version flag when downloading `pypiDeps` (default: "3.12"). Should match the Python shipped by your Pyodide runtime.
 * @property {boolean | string[]} [watch] Rebuild the model wheel and reload the dev server when the model's `src/` or `pyproject.toml` changes (default: true). An array adds more paths to watch, relative to the Vite root like `model`, e.g. a flat-layout package directory. `false` builds once at startup only. `pypiDeps` and `localDeps` are never rebuilt.
 */

const DEFAULT_PYODIDE_PACKAGES = ["micropip", "numpy"];

/** @param {string} publicDir */
function wheelFiles(publicDir) {
  return readdirSync(publicDir).filter((f) => f.endsWith(".whl"));
}

/**
 * Vite plugin that builds a Python wheel from a local model directory
 * and generates wheels.json + pyodide-packages.json in Vite's `publicDir`.
 *
 * Use `pypiDeps` to prebuild PyPI packages (like cfasim-model) as local
 * wheels for faster browser runtime — avoids PyPI round-trips on page load.
 *
 * Use `pyodidePackages` to preload Pyodide built-in packages (scipy, pandas,
 * etc.) into the Pyodide worker on startup.
 *
 * In `vite dev` the model's `src/` and `pyproject.toml` are watched: a
 * change rebuilds the model wheel in the background and reloads the page.
 *
 * @param {CfasimPyodideOptions} [options]
 * @returns {import("vite").Plugin}
 */
export function cfasimPyodide(options) {
  const modelDir = options?.model ?? "model";
  const pipCommand = options?.pipCommand ?? "uvx pip";
  const [pipFile, ...pipArgs] = Array.isArray(pipCommand)
    ? pipCommand
    : pipCommand.trim().split(/\s+/);
  const pythonVersion = options?.pythonVersion ?? "3.12";
  const extraPackages = options?.pyodidePackages ?? [];
  const watch = options?.watch ?? true;
  const pluginName = "cfasim-pyodide";
  const pyodidePackages = [
    ...new Set([...DEFAULT_PYODIDE_PACKAGES, ...extraPackages]),
  ];

  /**
   * @param {string} dir Package directory to build
   * @param {string} publicDir
   */
  function wheelArgs(dir, publicDir) {
    return ["build", dir, "--wheel", "--out-dir", publicDir];
  }

  // The model's wheel from the last build. A rebuild under a new filename
  // (a version bump in pyproject.toml) removes it, so wheels.json never
  // lists two wheels of the module.
  /** @type {string | undefined} */
  let modelWheel;

  /**
   * Build the model wheel and rewrite wheels.json. Returns the new wheel's
   * path when the build produced a filename that was not there before, so
   * the dev-server reload can wait for Vite's watcher to report it.
   *
   * @param {string} root Resolved Vite root
   * @param {string} publicDir Resolved Vite public directory
   * @returns {Promise<string[]>}
   */
  async function buildModel(root, publicDir) {
    const before = wheelFiles(publicDir);
    await execFileAsync("uv", wheelArgs(modelDir, publicDir), root);
    const added = wheelFiles(publicDir).find((f) => !before.includes(f));
    if (added !== undefined) {
      if (modelWheel && modelWheel !== added) {
        rmSync(resolve(publicDir, modelWheel), { force: true });
      }
      modelWheel = added;
    }
    writeFileSync(
      resolve(publicDir, "wheels.json"),
      JSON.stringify(wheelFiles(publicDir)),
    );
    return added === undefined ? [] : [resolve(publicDir, added)];
  }

  /**
   * @param {string} root Resolved Vite root
   * @param {string} publicDir Resolved Vite public directory
   */
  async function buildAll(root, publicDir) {
    mkdirSync(publicDir, { recursive: true });
    // Clear stale wheels so wheels.json only lists this build's output.
    for (const f of wheelFiles(publicDir)) rmSync(resolve(publicDir, f));
    for (const dep of options?.pypiDeps ?? []) {
      await execFileAsync(
        pipFile,
        [
          ...pipArgs,
          "download",
          dep,
          "--dest",
          publicDir,
          "--no-deps",
          "--python-version",
          pythonVersion,
          "--platform",
          "any",
        ],
        root,
      );
    }
    for (const dep of options?.localDeps ?? []) {
      await execFileAsync("uv", wheelArgs(dep, publicDir), root);
    }
    await buildModel(root, publicDir);
    writeFileSync(
      resolve(publicDir, "pyodide-packages.json"),
      JSON.stringify(pyodidePackages),
    );
  }

  return {
    name: pluginName,
    async configResolved(config) {
      await buildAll(
        config.root,
        resolvePublicDir(config.root, config.publicDir, pluginName),
      );
    },
    configureServer(server) {
      const { root } = server.config;
      const publicDir = resolvePublicDir(
        root,
        server.config.publicDir,
        pluginName,
      );
      watchModel(server, {
        name: pluginName,
        model: modelDir,
        manifest: "pyproject.toml",
        watch,
        // setuptools writes build/ (and uv build dist/) under the package.
        outputs: ["build", "dist"],
        publicDir,
        build: () => buildModel(root, publicDir),
      });
    },
  };
}

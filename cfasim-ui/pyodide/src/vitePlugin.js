import { execSync } from "node:child_process";
import { readdirSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * @typedef {object} CfasimPyodideOptions
 * @property {string} [model] Path to the Python model directory (default: "model")
 * @property {string[]} [pypiDeps] PyPI packages to download at build time and serve locally
 * @property {string[]} [pyodidePackages] Pyodide built-in packages to preload in the worker (e.g. "scipy", "pandas"). See https://pyodide.org/en/stable/usage/packages-in-pyodide.html. `micropip` and `numpy` are always included.
 * @property {string} [pipCommand] Command used to invoke pip for downloading `pypiDeps` (default: "uvx pip"). Override with e.g. "pip" or "uv run pip".
 * @property {string} [pythonVersion] Python version passed to pip's --python-version flag when downloading `pypiDeps` (default: "3.12"). Should match the Python shipped by your Pyodide runtime.
 */

const DEFAULT_PYODIDE_PACKAGES = ["micropip", "numpy"];

/**
 * Vite plugin that builds a Python wheel from a local model directory
 * and generates wheels.json + pyodide-packages.json in the public directory.
 *
 * Use `pypiDeps` to prebuild PyPI packages (like cfasim-model) as local
 * wheels for faster browser runtime — avoids PyPI round-trips on page load.
 *
 * Use `pyodidePackages` to preload Pyodide built-in packages (scipy, pandas,
 * etc.) into the Pyodide worker on startup.
 *
 * @param {CfasimPyodideOptions} [options]
 * @returns {import("vite").Plugin}
 */
export function cfasimPyodide(options) {
  const modelDir = options?.model ?? "model";
  const pipCommand = options?.pipCommand ?? "uvx pip";
  const pythonVersion = options?.pythonVersion ?? "3.12";
  const extraPackages = options?.pyodidePackages ?? [];
  const pyodidePackages = [
    ...new Set([...DEFAULT_PYODIDE_PACKAGES, ...extraPackages]),
  ];

  function build(root) {
    const publicDir = resolve(root, "public");
    mkdirSync(publicDir, { recursive: true });
    // Clear stale wheels so wheels.json only lists this build's output.
    for (const f of readdirSync(publicDir)) {
      if (f.endsWith(".whl")) rmSync(resolve(publicDir, f));
    }
    for (const dep of options?.pypiDeps ?? []) {
      execSync(
        `${pipCommand} download ${dep} --dest public --no-deps --python-version ${pythonVersion} --platform any`,
        { cwd: root, stdio: "pipe" },
      );
    }
    execSync(`uv build ${modelDir} --wheel --out-dir public`, {
      cwd: root,
      stdio: "pipe",
    });
    const wheels = readdirSync(publicDir).filter((f) => f.endsWith(".whl"));
    writeFileSync(resolve(publicDir, "wheels.json"), JSON.stringify(wheels));
    writeFileSync(
      resolve(publicDir, "pyodide-packages.json"),
      JSON.stringify(pyodidePackages),
    );
  }

  return {
    name: "cfasim-pyodide",
    configResolved(config) {
      build(config.root);
    },
  };
}

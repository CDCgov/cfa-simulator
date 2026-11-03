import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { promisify } from "node:util";

/**
 * Dev-server rebuild wiring shared by the wasm and pyodide Vite plugins:
 * watch the model's source through Vite's own chokidar instance, rebuild
 * when a file under it changes, and reload the page (or show the error
 * overlay when the build fails). Vite serves `publicDir` with
 * `Cache-Control: no-cache`, so the reloaded page's fresh worker fetches
 * the new build without a new cache-busting hash.
 */

/**
 * @typedef {object} RebuildWatcherOptions
 * @property {string} name Plugin name for log lines and the error overlay
 * @property {string[]} paths Files or directories to watch (absolute). A path that does not exist is reported with a warning so a layout the defaults do not fit is visible.
 * @property {string[]} [exclude] Directories under `paths` whose changes never count (absolute): the build's own outputs, so a build cannot retrigger itself. Vite's `build.outDir` is always excluded; the directory the build writes into is the caller's to pass, since it knows where it built.
 * @property {() => Promise<string[] | void>} build Rebuilds the model; a rejection's message is shown as the build error. It may return the absolute paths of files it created under `publicDir` with names that did not exist before: Vite serves a public file only once its watcher has reported it, so the reload waits for those `add` events.
 * @property {number} [debounceMs] Quiet time after the last change before building (default 100)
 * @property {number} [addTimeoutMs] How long to wait for the watcher to report a created file before reloading anyway (default 2000)
 */

/**
 * @typedef {object} RebuildLogger
 * @property {(msg: string, opts?: { timestamp?: boolean }) => void} info
 * @property {(msg: string, opts?: { timestamp?: boolean }) => void} warn
 * @property {(msg: string, opts?: { timestamp?: boolean }) => void} error
 */

/**
 * @typedef {object} RebuildServer Subset of `ViteDevServer` the watcher uses
 * @property {{ root: string, build: { outDir: string }, logger: RebuildLogger }} config
 * @property {{ add: (paths: string | string[]) => unknown, on: (event: string, listener: (path: string) => void) => unknown }} watcher
 * @property {{ send: (payload: any) => void }} [hot] Vite 5.1+
 * @property {{ send: (payload: any) => void }} [ws] Older Vite
 * @property {{ once: (event: string, listener: () => void) => unknown } | null} [httpServer]
 * @property {() => Promise<void>} close
 */

const execFileP = promisify(execFile);

/**
 * Path segments that are never model source, at any depth: hidden files
 * and directories (`.venv`, `.git`, editor swap files), editor backups,
 * what setuptools writes into `src/` during the very build this triggers,
 * bytecode caches and installed JS packages. Build output directories
 * (`target/`, `build/`, `dist/`) are NOT matched by name, since a module
 * may be called that; the plugins exclude their known locations instead.
 *
 * @param {string} segment
 */
function isIgnoredSegment(segment) {
  return (
    segment.startsWith(".") ||
    segment.endsWith("~") ||
    segment.endsWith(".egg-info") ||
    segment === "__pycache__" ||
    segment === "node_modules"
  );
}

/**
 * Vite's root as the `config` hook sees it, before Vite has resolved it:
 * the user's `root` against the cwd, like Vite itself does.
 *
 * @param {{ root?: string }} userConfig
 */
export function resolveRoot(userConfig) {
  return userConfig.root ? resolve(userConfig.root) : process.cwd();
}

/**
 * Vite's public directory, where a model build lands and the worker loads
 * it from. Takes either the user config's `publicDir` (relative to the
 * root) or the resolved one (absolute). A disabled public directory
 * (`false` in the user config, `""` once resolved) is an error: the plugin
 * cannot serve the model without it.
 *
 * @param {string} root Resolved Vite root
 * @param {string | false | undefined} publicDir
 * @param {string} name Plugin name for the error
 */
export function resolvePublicDir(root, publicDir, name) {
  if (publicDir === false || publicDir === "") {
    throw new Error(
      `${name}: Vite's publicDir is disabled, but the model is served from it`,
    );
  }
  return resolve(root, publicDir ?? "public");
}

/**
 * A chokidar `ignored` glob for everything under `dir`, for Vite's
 * `server.watch.ignored`: a build output that Vite's watcher should never
 * even see (cargo writes thousands of files under `target/`).
 *
 * @param {string} dir Absolute directory
 */
export function ignoreGlob(dir) {
  return `${resolve(dir).replace(/\\/g, "/")}/**`;
}

/**
 * @param {string} file Absolute, normalized
 * @param {string} dir Absolute, normalized
 */
function isUnder(file, dir) {
  return file === dir || file.startsWith(dir + sep);
}

/**
 * Whether a change to `file` should trigger a rebuild: it must sit under
 * one of `paths` (or be one of them) and under none of `exclude`, with no
 * ignored segment below that root. Roots may overlap; each is tried.
 *
 * @param {string} file
 * @param {string[]} paths Absolute watched files or directories
 * @param {string[]} [exclude] Absolute directories whose contents never count
 */
export function isWatchedFile(file, paths, exclude = []) {
  const f = resolve(file);
  if (exclude.some((dir) => isUnder(f, dir))) return false;
  for (const root of paths) {
    if (f === root) return true;
    if (!f.startsWith(root + sep)) continue;
    const rest = f.slice(root.length + 1).split(sep);
    if (!rest.some(isIgnoredSegment)) return true;
  }
  return false;
}

/**
 * Run a program with an argument array (no shell, so paths with spaces or
 * shell characters pass through intact), resolving when it exits 0. The
 * rejection message carries the command line and its stderr (or stdout),
 * which is where wasm-pack and uv print compiler errors.
 *
 * @param {string} file
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<void>}
 */
export async function execFileAsync(file, args, cwd) {
  try {
    await execFileP(file, args, { cwd, maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    const err = /** @type {Error & { stdout?: string, stderr?: string }} */ (e);
    const output = String(err.stderr || err.stdout || err.message).trim();
    throw new Error(`${[file, ...args].join(" ")}\n${output}`);
  }
}

/**
 * Watch `paths` on the dev server and rebuild on change. Changes are
 * debounced; a change that lands while a build runs re-arms the debounce
 * once it finishes, since the running build may have read stale sources.
 *
 * @param {RebuildServer} server
 * @param {RebuildWatcherOptions} options
 */
export function watchAndRebuild(server, options) {
  const { name, build, debounceMs = 100, addTimeoutMs = 2000 } = options;
  const { root, logger } = server.config;
  const paths = options.paths.map((p) => resolve(p));
  const exclude = (options.exclude ?? []).map((p) => resolve(p));
  exclude.push(resolve(root, server.config.build.outDir));
  const channel = server.hot ?? server.ws;
  if (!channel) throw new Error(`${name}: dev server has no hot channel`);
  /** @param {unknown} payload */
  const send = (payload) => channel.send(payload);
  for (const p of paths) {
    if (!existsSync(p)) {
      logger.warn(
        `${name}: ${p} does not exist; restart the dev server if changes there are not picked up once it does`,
        { timestamp: true },
      );
    }
  }
  server.watcher.add(paths);

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  let building = false;
  let dirty = false;
  let closed = false;
  /** Files the watcher reported added since the current build began. */
  const recentAdds = new Set();
  /** @type {Map<string, () => void>} */
  const addWaiters = new Map();

  // The server going away (a Vite restart runs configureServer on the next
  // one) must drop a pending debounce and the result of a build in flight.
  // `httpServer` is null in middleware mode, so `close()` is covered too.
  function markClosed() {
    closed = true;
    clearTimeout(timer);
  }
  server.httpServer?.once("close", markClosed);
  const close = server.close;
  server.close = async () => {
    markClosed();
    await close.call(server);
  };

  /**
   * Vite's public middleware serves only files its watcher has reported,
   * so a reload sent before the `add` event for a newly created file would
   * fetch `index.html` in its place.
   *
   * @param {string[]} files
   */
  function awaitAdds(files) {
    return Promise.all(
      files.map((file) => {
        const f = resolve(file);
        if (recentAdds.has(f)) return Promise.resolve();
        return new Promise((done) => {
          const t = setTimeout(() => {
            addWaiters.delete(f);
            logger.warn(
              `${name}: the file watcher did not report ${f} within ${addTimeoutMs} ms, reloading anyway`,
              { timestamp: true },
            );
            done(undefined);
          }, addTimeoutMs);
          addWaiters.set(f, () => {
            clearTimeout(t);
            done(undefined);
          });
        });
      }),
    );
  }

  async function rebuild() {
    building = true;
    dirty = false;
    recentAdds.clear();
    const t0 = Date.now();
    try {
      const created = (await build()) ?? [];
      if (!closed) await awaitAdds(created);
      if (!closed) {
        const seconds = ((Date.now() - t0) / 1000).toFixed(1);
        logger.info(`${name}: rebuilt in ${seconds}s, reloading`, {
          timestamp: true,
        });
        send({ type: "full-reload", path: "*" });
      }
    } catch (e) {
      if (!closed) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error(`${name}: build failed\n${message}`, { timestamp: true });
        send({
          type: "error",
          err: {
            message: `${name}: build failed\n\n${message}`,
            stack: "",
            plugin: name,
          },
        });
      }
    }
    building = false;
    if (dirty && !closed) schedule();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(rebuild, debounceMs);
  }

  /** @param {string} file */
  function onAdd(file) {
    const f = resolve(file);
    recentAdds.add(f);
    const waiter = addWaiters.get(f);
    if (waiter) {
      addWaiters.delete(f);
      waiter();
    }
  }

  /** @param {string} file */
  function onChange(file) {
    if (closed || !isWatchedFile(file, paths, exclude)) return;
    if (building) {
      dirty = true;
      return;
    }
    schedule();
  }

  server.watcher.on("add", onAdd);
  for (const event of ["change", "add", "unlink"]) {
    server.watcher.on(event, onChange);
  }
}

/**
 * @typedef {object} ModelWatchOptions
 * @property {string} name Plugin name for log lines and the error overlay
 * @property {string} model Model directory, relative to the Vite root (the plugin's `model` option)
 * @property {string} manifest The model's manifest file under that directory: `Cargo.toml` or `pyproject.toml`
 * @property {boolean | string[]} watch The plugin's `watch` option: `false` watches nothing, an array adds root-relative paths
 * @property {string[]} outputs Build output directories under the model directory, never a trigger
 * @property {string} publicDir Resolved directory the build writes into
 * @property {() => Promise<string[] | void>} build Rebuilds the model; see `RebuildWatcherOptions.build`
 */

/**
 * The wasm and pyodide plugins' shared `configureServer` wiring: watch the
 * model's `src/` and manifest plus any extra paths, excluding the build's
 * own outputs.
 *
 * @param {RebuildServer} server
 * @param {ModelWatchOptions} options
 */
export function watchModel(server, options) {
  if (options.watch === false) return;
  const { root } = server.config;
  const model = resolve(root, options.model);
  const extra = Array.isArray(options.watch) ? options.watch : [];
  watchAndRebuild(server, {
    name: options.name,
    paths: [
      resolve(model, "src"),
      resolve(model, options.manifest),
      ...extra.map((p) => resolve(root, p)),
    ],
    exclude: [
      options.publicDir,
      ...options.outputs.map((dir) => resolve(model, dir)),
    ],
    build: options.build,
  });
}

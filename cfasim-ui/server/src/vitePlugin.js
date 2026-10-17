import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * @typedef {object} CfasimServerOptions
 * @property {string} [bin] The `cfasim` executable to run (default: `$CFASIM_BIN`, else `cfasim` on PATH, falling back to `uvx cfasim@<this package's version>`)
 * @property {string} [tasks] Passed as `--tasks`: a Python module or `.py` file, or the name of the Rust tasks binary (default: `cfasim serve` detects it from the project)
 * @property {string[]} [command] Full command to start the server; overrides every other option that shapes it, and does not get `--app-url` (default: `cfasim serve --port <port> --output <output> --app-url <dev server url>`)
 * @property {number} [port] Port the server listens on (default: 8765)
 * @property {string} [output] Directory that holds one folder per run, passed as `--output` (default: "output")
 * @property {boolean} [csv] Also write `<table>.csv` for each output table when a run finishes (passes `--csv`)
 * @property {boolean} [debug] Build a Rust tasks binary without `--release` (passes `--debug`)
 * @property {string} [cwd] Directory to start the server in (default: `process.cwd()`, the project root where `pyproject.toml` or `Cargo.toml` lives)
 */

const DEFAULT_PORT = 8765;
const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];
const STOP_TIMEOUT_MS = 5000;

/** @type {Record<symbol, Map<number, Promise<void>> | undefined>} */
const globals = /** @type {any} */ (globalThis);
/**
 * Servers still shutting down, by port. A Vite restart builds a new plugin
 * instance whose server must wait for the old one to free the port; the map
 * lives on globalThis so a re-bundled copy of this module shares it.
 */
const stopping = (globals[Symbol.for("cfasim-server.stopping")] ??= new Map());

/** @param {import("node:child_process").ChildProcess} proc */
const exited = (proc) => proc.exitCode !== null || proc.signalCode !== null;

/** This package's version, which is also the matching `cfasim` CLI version. */
function packageVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    return typeof pkg.version === "string" ? pkg.version : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Signal a child's whole process group (a detached child leads one); falls
 * back to the child alone where groups are unavailable.
 * @param {number} pid
 * @param {NodeJS.Signals} signal
 */
function signalGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // already gone
    }
  }
}

/**
 * The `serve` arguments shared by every launcher.
 * @param {CfasimServerOptions} options
 * @param {string} [appUrl]
 * @returns {string[]}
 */
function serveArgs(options, appUrl) {
  const args = [
    "serve",
    "--port",
    String(options.port ?? DEFAULT_PORT),
    "--output",
    options.output ?? "output",
  ];
  if (options.csv) args.push("--csv");
  if (options.debug) args.push("--debug");
  if (options.tasks) args.push("--tasks", options.tasks);
  if (appUrl) args.push("--app-url", appUrl);
  return args;
}

/**
 * Build the argv used to start the server.
 * @param {CfasimServerOptions} [options]
 * @param {string} [appUrl] Where the page is served; the server prints it once it is up
 * @returns {string[]}
 */
export function serverCommand(options = {}, appUrl) {
  if (options.command) return [...options.command];
  const bin = options.bin ?? process.env.CFASIM_BIN ?? "cfasim";
  return [bin, ...serveArgs(options, appUrl)];
}

/**
 * The command to try when `cfasim` is not installed: the matching release
 * through `uvx`, which caches it after the first run. `undefined` when the
 * user chose the executable themselves.
 * @param {CfasimServerOptions} [options]
 * @param {string} [appUrl]
 * @returns {string[] | undefined}
 */
export function fallbackCommand(options = {}, appUrl) {
  if (options.command || options.bin || process.env.CFASIM_BIN)
    return undefined;
  const version = packageVersion();
  const spec = version ? `cfasim@${version}` : "cfasim";
  return ["uvx", spec, ...serveArgs(options, appUrl)];
}

/**
 * The dev server's local URL, from the bound port (Vite may not get the port
 * it asked for) and the resolved config.
 * @param {import("vite").ViteDevServer} server
 * @returns {string | undefined}
 */
function appUrl(server) {
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") return undefined;
  const protocol = server.config.server.https ? "https" : "http";
  return `${protocol}://localhost:${address.port}${server.config.base}`;
}

/**
 * Vite plugin that starts `cfasim serve` next to the dev server and proxies
 * `/api` to it. It only runs for `vite dev`; a production build is a static
 * site that you serve with `cfasim serve --static dist`.
 *
 * @param {CfasimServerOptions} [options]
 * @returns {import("vite").Plugin}
 */
export function cfasimServer(options = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const cwd = options.cwd ?? process.cwd();

  return {
    name: "cfasim-server",
    apply: "serve",
    config() {
      return {
        server: {
          proxy: {
            "/api": { target: `http://127.0.0.1:${port}` },
          },
        },
      };
    },
    configureServer(server) {
      const logger = server.config.logger;
      let closing = false;
      /** @type {import("node:child_process").ChildProcess | undefined} */
      let child;

      /**
       * @param {string[]} command
       * @param {string[] | undefined} fallback Tried when `command[0]` is not installed
       */
      const launch = (command, fallback) => {
        logger.info(`[cfasim-server] starting: ${command.join(" ")}`);
        // Own process group, so stopping signals a launcher (uvx) and the
        // server it started together.
        child = spawn(command[0], command.slice(1), {
          cwd,
          stdio: "inherit",
          detached: true,
        });
        child.on("error", (err) => {
          if (
            fallback &&
            !closing &&
            /** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT"
          ) {
            logger.warn(
              `[cfasim-server] ${command[0]} is not installed; trying ${fallback.slice(0, 2).join(" ")}`,
            );
            launch(fallback, undefined);
            return;
          }
          logger.error(
            `[cfasim-server] failed to start (${err.message}). Install the cfasim CLI (\`cargo install cfasim\` or \`uv tool install cfasim\`) or set CFASIM_BIN to its path.`,
          );
        });
        child.on("exit", (code, signal) => {
          if (closing || code === 0 || code === null) return;
          logger.error(
            `[cfasim-server] exited with code ${code}${signal ? ` (${signal})` : ""}. If port ${port} is in use, stop the other server or set a different \`port\`.`,
          );
        });
      };

      // Start once Vite has its port, so the server can tell the user which
      // URL to open (the API port is the one people open by mistake).
      const start = () => {
        if (closing) return;
        const previous = stopping.get(port);
        if (previous) {
          // After a Vite restart, the old server may still hold the port.
          void previous.then(start);
          return;
        }
        const url = appUrl(server);
        const opts = { ...options, port };
        launch(serverCommand(opts, url), fallbackCommand(opts, url));
      };
      const httpServer = server.httpServer;
      if (httpServer && !httpServer.listening) {
        httpServer.once("listening", start);
      } else {
        start();
      }

      const stop = () => {
        if (closing) return;
        closing = true;
        for (const sig of SIGNALS) process.off(sig, onSignal);
        process.off("exit", stop);
        const proc = child;
        const pid = proc?.pid;
        if (!proc || exited(proc) || pid === undefined) return;
        /** @type {Promise<void>} */
        const done = new Promise((resolve) => {
          proc.once("exit", () => resolve());
          setTimeout(resolve, STOP_TIMEOUT_MS).unref();
        });
        stopping.set(port, done);
        void done.then(() => {
          if (stopping.get(port) === done) stopping.delete(port);
        });
        signalGroup(pid, "SIGTERM");
        // The server stops its worker and exits on SIGTERM; this is the
        // backstop for a launcher that ignores it.
        const backstop = setTimeout(() => {
          if (!exited(proc)) signalGroup(pid, "SIGKILL");
        }, 3000);
        backstop.unref();
      };
      // Vite's own SIGTERM handling exits without running "exit" listeners,
      // so hook the signals too or the server outlives the dev server.
      // Listening suppresses Node's default exit, so hand the signal back
      // afterwards (signal-exit, which rolldown installs, only re-raises when
      // it is the sole listener, so waiting for it would hang). SIGTERM is
      // Vite's to finish: it closes the server and exits.
      /** @param {NodeJS.Signals} sig */
      const onSignal = (sig) => {
        stop();
        if (sig !== "SIGTERM") process.kill(process.pid, sig);
      };
      for (const sig of SIGNALS) process.once(sig, onSignal);
      process.once("exit", stop);
      httpServer?.once("close", stop);
    },
  };
}

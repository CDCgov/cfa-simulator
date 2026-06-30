import { createWorkerPool } from "@cfasim-ui/shared/worker-pool";
import type { WorkerResponse } from "@cfasim-ui/shared/worker-pool";

export type PyodideResponse = WorkerResponse;

/**
 * Worker names are arbitrary string keys. Workers are spawned lazily on first
 * use; each one is an independent Pyodide interpreter. Use distinct names when
 * you want runs to execute in parallel without contention.
 */
export type WorkerName = string;

const DEFAULT_WORKER = "default";

const pool = createWorkerPool({
  createWorker: () =>
    new Worker(new URL("./pyodide.worker.ts", import.meta.url), {
      type: "module",
    }),
  loadMessage: (module) => ({ type: "loadModule", module }),
});

/**
 * Mark `moduleName` as a shared module: install it on every currently-spawned
 * worker, and on any future worker the moment it spawns. Returns once the
 * default worker has finished installing.
 */
export function loadModule(moduleName: string): Promise<PyodideResponse> {
  return pool.load(moduleName);
}

/**
 * Install `moduleName` on a single worker. Spawns the worker if needed. Does
 * not mark the module as shared — other workers won't auto-load it. Use this
 * when one worker should diverge from others.
 */
export function loadModuleOnWorker(
  moduleName: string,
  worker: WorkerName,
): Promise<PyodideResponse> {
  return pool.loadOnWorker(moduleName, worker);
}

/**
 * Run an arbitrary Python script. `context` keys are exposed as Python globals.
 * Prefer {@link callPython} when calling a function on a loaded module — it
 * skips Python source parsing on every invocation.
 */
export function asyncRunPython(
  script: string,
  context?: Record<string, unknown>,
  worker: WorkerName = DEFAULT_WORKER,
): Promise<PyodideResponse> {
  return pool.request(worker, { type: "run", python: script, context });
}

/**
 * Call `module.fn(**kwargs)` on the named worker. Faster than asyncRunPython
 * for repeated invocations: the worker caches the imported module and dispatches
 * directly to the cached function rather than re-parsing source each call.
 */
export async function callPython(
  module: string,
  fn: string,
  kwargs?: Record<string, unknown>,
  worker: WorkerName = DEFAULT_WORKER,
): Promise<PyodideResponse> {
  const installResult = await pool.ensureLoaded(module, worker);
  if (installResult.error) return installResult;
  return pool.request(worker, { type: "call", module, fn, kwargs });
}

/**
 * Pre-spawn the named workers and (optionally) pre-install modules on each.
 * Pyodide takes a few seconds to boot, so warming workers up front lets the
 * first call return immediately. Call this once near app startup when you
 * know you'll need parallel interpreters (e.g. for side-by-side comparisons).
 *
 * Modules listed in `modules` are also registered as shared, so any worker
 * spawned later will auto-install them.
 */
export function warmWorkers(options: {
  workers: WorkerName[];
  modules?: string[];
}): Promise<void> {
  return pool.warm({ workers: options.workers, keys: options.modules });
}

import type { TransferableResponse } from "@cfasim-ui/shared";
import { unwrapResponse } from "@cfasim-ui/shared";

let lastId = 0;
function getId(): number {
  return ++lastId;
}

interface RunMessage {
  id: number;
  type?: "run";
  python: string;
  context?: Record<string, unknown>;
}
interface CallMessage {
  id: number;
  type: "call";
  module: string;
  fn: string;
  kwargs?: Record<string, unknown>;
}
interface LoadModuleMessage {
  id: number;
  type: "loadModule";
  module: string;
}
type WorkerMessage = RunMessage | CallMessage | LoadModuleMessage;
type OutgoingMessage =
  | Omit<RunMessage, "id">
  | Omit<CallMessage, "id">
  | Omit<LoadModuleMessage, "id">;

function requestResponse(
  worker: Worker,
  msg: OutgoingMessage,
): Promise<{ result?: unknown; error?: string }> {
  return new Promise((resolve) => {
    const id = getId();
    function listener(event: MessageEvent<TransferableResponse>) {
      if (event.data?.id !== id) return;
      worker.removeEventListener("message", listener);
      if (event.data.error) {
        resolve({ error: event.data.error });
      } else {
        resolve({ result: unwrapResponse(event.data) });
      }
    }
    worker.addEventListener("message", listener);
    worker.postMessage({ id, ...msg } as WorkerMessage);
  });
}

/**
 * Worker names are arbitrary string keys. Workers are spawned lazily on first
 * use; each one is an independent Pyodide interpreter. Use distinct names when
 * you want runs to execute in parallel without contention.
 */
export type WorkerName = string;

const DEFAULT_WORKER = "default";

interface WorkerEntry {
  worker: Worker;
  modules: Map<string, Promise<{ result?: unknown; error?: string }>>;
}

const workers = new Map<string, WorkerEntry>();
// Modules registered via loadModule() — auto-installed on any newly spawned worker.
const sharedModules = new Set<string>();

function getWorker(name: string): WorkerEntry {
  let entry = workers.get(name);
  if (!entry) {
    const worker = new Worker(new URL("./pyodide.worker.ts", import.meta.url), {
      type: "module",
    });
    entry = { worker, modules: new Map() };
    workers.set(name, entry);
    for (const mod of sharedModules) {
      ensureModuleOn(entry, mod);
    }
  }
  return entry;
}

function ensureModuleOn(
  entry: WorkerEntry,
  moduleName: string,
): Promise<{ result?: unknown; error?: string }> {
  let p = entry.modules.get(moduleName);
  if (!p) {
    p = requestResponse(entry.worker, {
      type: "loadModule",
      module: moduleName,
    });
    entry.modules.set(moduleName, p);
    p.then((r) => {
      if (r.error) entry.modules.delete(moduleName);
    });
  }
  return p;
}

/**
 * Mark `moduleName` as a shared module: install it on every currently-spawned
 * worker, and on any future worker the moment it spawns. Returns once the
 * default worker has finished installing.
 */
export async function loadModule(
  moduleName: string,
): Promise<{ result?: unknown; error?: string }> {
  sharedModules.add(moduleName);
  // Always install on the default worker — that's what callers expect when
  // the function name has no "OnWorker" suffix.
  const defaultInstall = ensureModuleOn(getWorker(DEFAULT_WORKER), moduleName);
  const others: Array<Promise<unknown>> = [];
  for (const [name, entry] of workers) {
    if (name !== DEFAULT_WORKER) others.push(ensureModuleOn(entry, moduleName));
  }
  await Promise.all(others);
  return defaultInstall;
}

/**
 * Install `moduleName` on a single worker. Spawns the worker if needed. Does
 * not mark the module as shared — other workers won't auto-load it. Use this
 * when one worker should diverge from others.
 */
export async function loadModuleOnWorker(
  moduleName: string,
  worker: WorkerName,
): Promise<{ result?: unknown; error?: string }> {
  return ensureModuleOn(getWorker(worker), moduleName);
}

/**
 * Run an arbitrary Python script. `context` keys are exposed as Python globals.
 * Prefer {@link callPython} when calling a function on a loaded module — it
 * skips Python source parsing on every invocation.
 */
export async function asyncRunPython(
  script: string,
  context?: Record<string, unknown>,
  worker: WorkerName = DEFAULT_WORKER,
): Promise<{ result?: unknown; error?: string }> {
  return requestResponse(getWorker(worker).worker, {
    type: "run",
    python: script,
    context,
  });
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
): Promise<{ result?: unknown; error?: string }> {
  const entry = getWorker(worker);
  const installResult = await ensureModuleOn(entry, module);
  if (installResult.error) return installResult;
  return requestResponse(entry.worker, {
    type: "call",
    module,
    fn,
    kwargs,
  });
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
export async function warmWorkers(options: {
  workers: WorkerName[];
  modules?: string[];
}): Promise<void> {
  const modules = options.modules ?? [];
  for (const mod of modules) sharedModules.add(mod);
  const installs: Array<Promise<unknown>> = [];
  for (const name of options.workers) {
    const entry = getWorker(name);
    for (const mod of modules) installs.push(ensureModuleOn(entry, mod));
  }
  await Promise.all(installs);
}

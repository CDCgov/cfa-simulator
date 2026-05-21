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

export type PyodideResponse = { result?: unknown; error?: string };

/**
 * Convert a worker `ErrorEvent` into a human-readable message. Cross-origin
 * worker failures sanitize the event so every field is null/empty (e.g. a
 * dynamic `import("https://cdn…")` that fails at module evaluation): in
 * that case we fall back to a hint about likely causes instead of an
 * empty string, which would otherwise surface as a blank error.
 */
function describeWorkerError(e: ErrorEvent): string {
  const msg = e.message || e.error?.message || "";
  if (msg) {
    if (e.filename) return `${msg} (${e.filename}:${e.lineno})`;
    return msg;
  }
  return "Worker failed to load (no error details available — most often a cross-origin script load failure or a syntax error in the worker module)";
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
  modules: Map<string, Promise<PyodideResponse>>;
  /** Pending request id → resolver, so a worker-level crash can drain them all. */
  pending: Map<number, (r: PyodideResponse) => void>;
  /** Set once the worker has fired an error event — any further call short-circuits to this error. */
  deadError: string | null;
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
    const newEntry: WorkerEntry = {
      worker,
      modules: new Map(),
      pending: new Map(),
      deadError: null,
    };
    function failAll(message: string) {
      if (newEntry.deadError) return;
      newEntry.deadError = message;
      // Drop cached module promises so a future loadModule on a respawned
      // worker (if the caller chooses to retry) re-installs.
      newEntry.modules.clear();
      const pending = Array.from(newEntry.pending.values());
      newEntry.pending.clear();
      for (const resolve of pending) resolve({ error: message });
    }
    worker.addEventListener("error", (e: ErrorEvent) => {
      failAll(describeWorkerError(e));
    });
    worker.addEventListener("messageerror", () => {
      failAll(
        "Worker received a message it could not deserialize (messageerror)",
      );
    });
    entry = newEntry;
    workers.set(name, entry);
    for (const mod of sharedModules) {
      ensureModuleOn(entry, mod);
    }
  }
  return entry;
}

function requestResponse(
  entry: WorkerEntry,
  msg: OutgoingMessage,
): Promise<PyodideResponse> {
  if (entry.deadError) {
    return Promise.resolve({ error: entry.deadError });
  }
  return new Promise((resolve) => {
    const id = getId();
    entry.pending.set(id, resolve);
    function listener(event: MessageEvent<TransferableResponse>) {
      if (event.data?.id !== id) return;
      entry.worker.removeEventListener("message", listener);
      entry.pending.delete(id);
      if (event.data.error) {
        resolve({ error: event.data.error });
      } else {
        resolve({ result: unwrapResponse(event.data) });
      }
    }
    entry.worker.addEventListener("message", listener);
    entry.worker.postMessage({ id, ...msg } as WorkerMessage);
  });
}

function ensureModuleOn(
  entry: WorkerEntry,
  moduleName: string,
): Promise<PyodideResponse> {
  let p = entry.modules.get(moduleName);
  if (!p) {
    p = requestResponse(entry, {
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
export async function loadModule(moduleName: string): Promise<PyodideResponse> {
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
): Promise<PyodideResponse> {
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
): Promise<PyodideResponse> {
  return requestResponse(getWorker(worker), {
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
): Promise<PyodideResponse> {
  const entry = getWorker(worker);
  const installResult = await ensureModuleOn(entry, module);
  if (installResult.error) return installResult;
  return requestResponse(entry, {
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

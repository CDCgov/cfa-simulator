import type { TransferableResponse } from "./transferUtils.js";
import { unwrapResponse } from "./transferUtils.js";

/** Uniform result shape: exactly one of `result` / `error` is set. */
export interface WorkerResponse {
  result?: unknown;
  error?: string;
}

/**
 * Convert a worker `ErrorEvent` into a human-readable message. Cross-origin
 * worker failures sanitize the event so every field is null/empty (e.g. a
 * dynamic `import("https://cdn…")` that fails at module evaluation): in that
 * case we fall back to `fallback` instead of an empty string, which would
 * otherwise surface as a blank error.
 */
export function describeWorkerError(
  event: ErrorEvent,
  fallback = "Worker failed to load (no error details available — most often a cross-origin script load failure or a syntax error in the worker module)",
): string {
  const msg = event.message || event.error?.message || "";
  if (msg) {
    if (event.filename) return `${msg} (${event.filename}:${event.lineno})`;
    return msg;
  }
  return fallback;
}

export interface WorkerPoolOptions {
  /** Spawn a fresh worker. Called lazily the first time a worker name is used. */
  createWorker: () => Worker;
  /** Build the message that loads/installs `key` (a module/model name) on a worker. */
  loadMessage: (key: string) => Record<string, unknown>;
  /** Message shown when the worker reports a `messageerror`. */
  messageErrorText?: string;
}

/**
 * A pool of named, independent workers that each cache the same set of loaded
 * "keys" (Python modules / R models). Workers are spawned lazily on first use.
 * Shared by the Pyodide and rwasm runtimes; the message protocol is supplied
 * by `loadMessage` and the per-call domain wrappers.
 */
export interface WorkerPool {
  /** Post `msg` to the named worker and resolve with its response. */
  request(
    worker: string,
    msg: Record<string, unknown>,
  ): Promise<WorkerResponse>;
  /** Ensure `key` is loaded on the named worker (cached), resolving once installed. */
  ensureLoaded(key: string, worker?: string): Promise<WorkerResponse>;
  /**
   * Mark `key` as shared: load it on every spawned worker and on any future
   * worker the moment it spawns. Resolves once the default worker has loaded it.
   */
  load(key: string): Promise<WorkerResponse>;
  /** Load `key` on a single worker without marking it shared. */
  loadOnWorker(key: string, worker: string): Promise<WorkerResponse>;
  /** Pre-spawn workers and optionally pre-load (and share) `keys` on each. */
  warm(options: { workers: string[]; keys?: string[] }): Promise<void>;
}

const DEFAULT_WORKER = "default";

interface WorkerEntry {
  worker: Worker;
  /** key (module/model) → install promise. */
  loaded: Map<string, Promise<WorkerResponse>>;
  /** Pending request id → resolver, so a worker-level crash can drain them all. */
  pending: Map<number, (r: WorkerResponse) => void>;
  /** Set once the worker has fired an error event — any further call short-circuits to this error. */
  deadError: string | null;
}

export function createWorkerPool(options: WorkerPoolOptions): WorkerPool {
  const { createWorker, loadMessage } = options;
  const messageErrorText =
    options.messageErrorText ??
    "Worker received a message it could not deserialize (messageerror)";

  const workers = new Map<string, WorkerEntry>();
  const sharedKeys = new Set<string>();
  let lastId = 0;

  function getWorker(name: string): WorkerEntry {
    let entry = workers.get(name);
    if (entry) return entry;

    const worker = createWorker();
    const created: WorkerEntry = {
      worker,
      loaded: new Map(),
      pending: new Map(),
      deadError: null,
    };
    function failAll(message: string) {
      if (created.deadError) return;
      created.deadError = message;
      // Drop cached install promises so a future load on a respawned worker
      // (if the caller chooses to retry) re-installs.
      created.loaded.clear();
      const resolvers = Array.from(created.pending.values());
      created.pending.clear();
      for (const resolve of resolvers) resolve({ error: message });
    }
    worker.addEventListener("error", (event: ErrorEvent) => {
      failAll(describeWorkerError(event));
    });
    worker.addEventListener("messageerror", () => {
      failAll(messageErrorText);
    });
    workers.set(name, created);
    for (const key of sharedKeys) ensureLoadedOn(created, key);
    return created;
  }

  function request(
    entry: WorkerEntry,
    msg: Record<string, unknown>,
  ): Promise<WorkerResponse> {
    if (entry.deadError) {
      return Promise.resolve({ error: entry.deadError });
    }
    return new Promise((resolve) => {
      const id = ++lastId;
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
      entry.worker.postMessage({ id, ...msg });
    });
  }

  function ensureLoadedOn(
    entry: WorkerEntry,
    key: string,
  ): Promise<WorkerResponse> {
    let promise = entry.loaded.get(key);
    if (!promise) {
      promise = request(entry, loadMessage(key));
      entry.loaded.set(key, promise);
      promise.then((r) => {
        if (r.error) entry.loaded.delete(key);
      });
    }
    return promise;
  }

  return {
    request: (worker, msg) => request(getWorker(worker), msg),
    ensureLoaded: (key, worker = DEFAULT_WORKER) =>
      ensureLoadedOn(getWorker(worker), key),
    async load(key) {
      sharedKeys.add(key);
      const defaultInstall = ensureLoadedOn(getWorker(DEFAULT_WORKER), key);
      const others: Array<Promise<unknown>> = [];
      for (const [name, entry] of workers) {
        if (name !== DEFAULT_WORKER) others.push(ensureLoadedOn(entry, key));
      }
      await Promise.all(others);
      return defaultInstall;
    },
    loadOnWorker: (key, worker) => ensureLoadedOn(getWorker(worker), key),
    async warm(opts) {
      const keys = opts.keys ?? [];
      for (const key of keys) sharedKeys.add(key);
      const installs: Array<Promise<unknown>> = [];
      for (const name of opts.workers) {
        const entry = getWorker(name);
        for (const key of keys) installs.push(ensureLoadedOn(entry, key));
      }
      await Promise.all(installs);
    },
  };
}

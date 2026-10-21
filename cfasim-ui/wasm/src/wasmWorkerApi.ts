import type { TransferableResponse, WasmTrapKind } from "@cfasim-ui/shared";
import {
  unwrapResponse,
  describeWorkerError,
  MESSAGEERROR_TEXT,
} from "@cfasim-ui/shared";
import type { WorkerMessage } from "./messages.js";

let lastId = 0;

interface Pending {
  message: WorkerMessage;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

// In-flight calls keyed by request id. `cancelWasm` fails them when it
// terminates the worker mid-run, worker-level errors drain them all at once,
// and a trap re-sends the survivors to the replacement worker.
const pending = new Map<number, Pending>();

// Set when the worker fires an `error` / `messageerror` event, which fails
// every pending call. A `runWasm` after `WORKER_RETRY_MS` starts a fresh
// worker; sooner ones get the same rejection, so a worker script that never
// loads costs one spawn per retry window, not one per slider tick.
let workerDeadError: Error | null = null;
let workerDiedAt = 0;
const WORKER_RETRY_MS = 2000;

function newWorker(): Worker {
  const w = new Worker(new URL("./wasm.worker.ts", import.meta.url), {
    type: "module",
  });
  function failAll(message: string) {
    if (workerDeadError) return;
    workerDeadError = new Error(message);
    workerDiedAt = Date.now();
    const entries = Array.from(pending.values());
    pending.clear();
    for (const entry of entries) entry.reject(workerDeadError);
  }
  // Events from a worker that has since been replaced are stale: its
  // requests were re-sent to, or failed with, the current worker.
  w.addEventListener("error", (e: ErrorEvent) => {
    if (w !== worker) return;
    failAll(describeWorkerError(e));
  });
  w.addEventListener("messageerror", () => {
    if (w !== worker) return;
    failAll(MESSAGEERROR_TEXT);
  });
  w.addEventListener("message", (event: MessageEvent<TransferableResponse>) => {
    if (w !== worker) return;
    const data = event.data;
    const entry = data && pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.error !== undefined) {
      const error = new Error(data.error);
      if (data.trap) replaceWorker(entry.message, data.trap, error);
      entry.reject(error);
    } else {
      entry.resolve(unwrapResponse(data));
    }
  });
  return w;
}

let worker = newWorker();

function restartWorker(): void {
  worker.terminate();
  workerDeadError = null;
  worker = newWorker();
}

function sameCall(a: WorkerMessage, b: WorkerMessage): boolean {
  return (
    a.model === b.model &&
    a.fn === b.fn &&
    a.args.length === b.args.length &&
    a.args.every((arg, i) => arg === b.args[i])
  );
}

/**
 * Swap in a fresh worker after a WebAssembly trap. A Rust panic aborts
 * without unwinding, so the old instance may be left with poisoned state
 * (a `RefCell` still borrowed, a half-updated cache) that would fail every
 * later call. The other in-flight calls move to the new worker, except
 * those that would trap the same way: the same call again, or any call
 * into a model whose initialization trapped. Calls with other inputs are
 * re-sent even though they may trap too, each costing another replacement:
 * failing them instead would report an error for inputs that might work and
 * never retry them.
 */
function replaceWorker(
  trapped: WorkerMessage,
  kind: WasmTrapKind,
  error: Error,
): void {
  restartWorker();
  for (const [id, entry] of Array.from(pending)) {
    const doomed =
      kind === "init"
        ? entry.message.model === trapped.model
        : sameCall(entry.message, trapped);
    if (doomed) {
      pending.delete(id);
      entry.reject(error);
    } else {
      worker.postMessage(entry.message);
    }
  }
}

export function runWasm(
  model: string,
  fn: string,
  ...args: string[]
): Promise<unknown> {
  if (workerDeadError) {
    // The worker's module failed to load or it posted something unreadable.
    // That can be transient (a dev server restart), so try a fresh one
    // rather than failing every call for the rest of the page's life.
    if (Date.now() - workerDiedAt < WORKER_RETRY_MS) {
      return Promise.reject(workerDeadError);
    }
    restartWorker();
  }
  return new Promise((resolve, reject) => {
    const id = ++lastId;
    const message: WorkerMessage = { id, model, fn, args };
    pending.set(id, { message, resolve, reject });
    worker.postMessage(message);
  });
}

/**
 * Terminate the worker and reject any in-flight `runWasm` promises with
 * `Error("cancelled")`. A fresh worker is spawned for subsequent calls,
 * which means the wasm module cache is lost and the next call pays the
 * one-time module init cost. Use only when the running computation is
 * known to be obsolete (e.g. the user has changed inputs).
 */
export function cancelWasm(): void {
  if (pending.size === 0) return;
  const entries = Array.from(pending.values());
  pending.clear();
  restartWorker();
  for (const entry of entries) {
    entry.reject(new Error("cancelled"));
  }
}

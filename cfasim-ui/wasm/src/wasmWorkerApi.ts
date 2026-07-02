import type { TransferableResponse } from "@cfasim-ui/shared";
import {
  unwrapResponse,
  describeWorkerError,
  MESSAGEERROR_TEXT,
} from "@cfasim-ui/shared";
import type { WorkerMessage } from "./messages.js";

let lastId = 0;

// Rejects keyed by request id so `cancelWasm` can fail in-flight promises
// when we terminate the worker mid-run, and so worker-level errors can drain
// every pending call at once.
const pendingRejects = new Map<number, (reason: Error) => void>();

// Set once the worker fires an `error` / `messageerror` event. Subsequent
// `runWasm` calls short-circuit with this error so the caller sees a real
// rejection instead of waiting forever on a worker that will never reply.
let workerDeadError: Error | null = null;

function newWorker(): Worker {
  const w = new Worker(new URL("./wasm.worker.ts", import.meta.url), {
    type: "module",
  });
  function failAll(message: string) {
    if (workerDeadError) return;
    workerDeadError = new Error(message);
    const rejects = Array.from(pendingRejects.values());
    pendingRejects.clear();
    for (const reject of rejects) reject(workerDeadError);
  }
  w.addEventListener("error", (e: ErrorEvent) => {
    failAll(describeWorkerError(e));
  });
  w.addEventListener("messageerror", () => {
    failAll(MESSAGEERROR_TEXT);
  });
  return w;
}

let worker = newWorker();

export function runWasm(
  model: string,
  fn: string,
  ...args: string[]
): Promise<unknown> {
  if (workerDeadError) {
    return Promise.reject(workerDeadError);
  }
  return new Promise((resolve, reject) => {
    const id = ++lastId;
    // Capture the current worker so a later `cancelWasm` that swaps the
    // worker reference doesn't leave the listener attached to a fresh
    // (unrelated) worker.
    const myWorker = worker;
    pendingRejects.set(id, reject);

    function listener(event: MessageEvent<TransferableResponse>) {
      if (event.data?.id !== id) return;
      myWorker.removeEventListener("message", listener);
      pendingRejects.delete(id);
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(unwrapResponse(event.data));
      }
    }

    myWorker.addEventListener("message", listener);
    myWorker.postMessage({ id, model, fn, args } as WorkerMessage);
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
  if (pendingRejects.size === 0) return;
  worker.terminate();
  const rejects = Array.from(pendingRejects.values());
  pendingRejects.clear();
  workerDeadError = null;
  worker = newWorker();
  for (const reject of rejects) {
    reject(new Error("cancelled"));
  }
}

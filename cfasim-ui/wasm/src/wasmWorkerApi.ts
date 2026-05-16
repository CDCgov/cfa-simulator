import type { TransferableResponse } from "@cfasim-ui/shared";
import { unwrapResponse } from "@cfasim-ui/shared";

interface WorkerMessage {
  id: number;
  model: string;
  fn: string;
  args: string[];
}

let lastId = 0;

function newWorker(): Worker {
  return new Worker(new URL("./wasm.worker.ts", import.meta.url), {
    type: "module",
  });
}

let worker = newWorker();

// Rejects keyed by request id so `cancelWasm` can fail in-flight promises
// when we terminate the worker mid-run.
const pendingRejects = new Map<number, (reason: Error) => void>();

export function runWasm(
  model: string,
  fn: string,
  ...args: string[]
): Promise<unknown> {
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
  worker = newWorker();
  for (const reject of rejects) {
    reject(new Error("cancelled"));
  }
}

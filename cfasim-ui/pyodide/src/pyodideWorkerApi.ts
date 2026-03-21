import type { TransferableResponse } from "@cfasim-ui/shared";
import { unwrapResponse } from "@cfasim-ui/shared";

interface PromiseResolver<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function getPromiseAndResolve<T>(): PromiseResolver<T> {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve: resolve! };
}

let lastId = 0;
function getId(): number {
  return ++lastId;
}

interface WorkerMessage {
  id: number;
  type?: "run" | "loadModule";
  python?: string;
  module?: string;
  context?: Record<string, unknown>;
}

function requestResponse(
  worker: Worker,
  msg: Omit<WorkerMessage, "id">,
): Promise<{ result?: unknown; error?: string }> {
  const { promise, resolve } = getPromiseAndResolve<{
    result?: unknown;
    error?: string;
  }>();
  const idWorker = getId();

  function listener(event: MessageEvent<TransferableResponse>) {
    if (event.data?.id !== idWorker) {
      return;
    }
    worker.removeEventListener("message", listener);
    if (event.data.error) {
      resolve({ error: event.data.error });
    } else {
      resolve({ result: unwrapResponse(event.data) });
    }
  }

  worker.addEventListener("message", listener);
  worker.postMessage({ id: idWorker, ...msg } as WorkerMessage);
  return promise;
}

export type WorkerName = "baseline" | "intervention";

function createWorker(): Worker {
  return new Worker(new URL("./pyodide.worker.ts", import.meta.url), {
    type: "module",
  });
}

const workers: Record<WorkerName, Worker> = {
  baseline: createWorker(),
  intervention: createWorker(),
};

export async function loadModuleOnWorker(
  moduleName: string,
  worker: WorkerName,
): Promise<{ result?: unknown; error?: string }> {
  return requestResponse(workers[worker], {
    type: "loadModule",
    module: moduleName,
  });
}

export async function loadModule(
  moduleName: string,
): Promise<{ result?: unknown; error?: string }> {
  // Load module on all workers so any worker can run code that depends on it
  const results = await Promise.all(
    Object.values(workers).map((w) =>
      requestResponse(w, { type: "loadModule", module: moduleName }),
    ),
  );
  return results[0];
}

export async function asyncRunPython(
  script: string,
  context?: Record<string, unknown>,
  worker?: WorkerName,
): Promise<{ result?: unknown; error?: string }> {
  const target = worker ? workers[worker] : workers.baseline;
  return requestResponse(target, {
    python: script,
    context,
  });
}

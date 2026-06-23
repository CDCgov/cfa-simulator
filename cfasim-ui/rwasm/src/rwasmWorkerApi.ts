import type { ColumnDescriptor } from "@cfasim-ui/shared/model-output";
import { unwrapResponse } from "@cfasim-ui/shared/transfer";
import type { TransferableResponse } from "@cfasim-ui/shared/transfer";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface RwasmBundleManifest {
  name: string;
  entry: string;
  modelPackage?: string;
  modelBaseUrl: string;
  packages: string[];
  repoUrl?: string;
  libraryImageUrl?: string;
  webRBaseUrl?: string;
  createdBy: "cfasimRwasm";
}

export interface RWorkerRequest {
  id: number;
  type: "loadModel" | "run";
  model: string;
  fn?: string;
  params?: Record<string, JsonValue>;
}

export interface RWorkerResponse extends TransferableResponse {
  id: number;
  modelOutputs?: {
    outputs: Record<
      string,
      { length: number; columns: ColumnDescriptor[]; buffers: ArrayBuffer[] }
    >;
  };
}

export type WorkerName = string;

const DEFAULT_WORKER = "default";

let lastId = 0;
function getId(): number {
  return ++lastId;
}

function createWorker(): Worker {
  return new Worker(new URL("./rwasm.worker.ts", import.meta.url), {
    type: "module",
  });
}

type OutgoingMessage = Omit<RWorkerRequest, "id">;

export type RwasmResponse = { result?: unknown; error?: string };

function describeWorkerError(event: ErrorEvent): string {
  const msg = event.message || event.error?.message || "";
  if (msg) {
    if (event.filename) return `${msg} (${event.filename}:${event.lineno})`;
    return msg;
  }
  return "R worker failed to load (no error details available)";
}

function requestResponse(
  entry: WorkerEntry,
  msg: OutgoingMessage,
): Promise<RwasmResponse> {
  if (entry.deadError) {
    return Promise.resolve({ error: entry.deadError });
  }
  return new Promise((resolve) => {
    const id = getId();
    entry.pending.set(id, resolve);

    function listener(event: MessageEvent<RWorkerResponse>) {
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
    entry.worker.postMessage({ id, ...msg } satisfies RWorkerRequest);
  });
}

interface WorkerEntry {
  worker: Worker;
  models: Map<string, Promise<RwasmResponse>>;
  pending: Map<number, (r: RwasmResponse) => void>;
  deadError: string | null;
}

const workers = new Map<string, WorkerEntry>();
const sharedModels = new Set<string>();

function getWorker(name: string): WorkerEntry {
  let entry = workers.get(name);
  if (!entry) {
    const worker = createWorker();
    const newEntry: WorkerEntry = {
      worker,
      models: new Map(),
      pending: new Map(),
      deadError: null,
    };
    function failAll(message: string) {
      if (newEntry.deadError) return;
      newEntry.deadError = message;
      newEntry.models.clear();
      const pending = Array.from(newEntry.pending.values());
      newEntry.pending.clear();
      for (const resolve of pending) resolve({ error: message });
    }
    worker.addEventListener("error", (event: ErrorEvent) => {
      failAll(describeWorkerError(event));
    });
    worker.addEventListener("messageerror", () => {
      failAll("R worker could not deserialize its response");
    });
    entry = newEntry;
    workers.set(name, entry);
    for (const model of sharedModels) {
      ensureModelOn(entry, model);
    }
  }
  return entry;
}

function ensureModelOn(
  entry: WorkerEntry,
  model: string,
): Promise<RwasmResponse> {
  let promise = entry.models.get(model);
  if (!promise) {
    promise = requestResponse(entry, {
      type: "loadModel",
      model,
    });
    entry.models.set(model, promise);
    promise.then((response) => {
      if (response.error) entry.models.delete(model);
    });
  }
  return promise;
}

export async function loadModel(
  model: string,
): Promise<{ result?: true; error?: string }> {
  sharedModels.add(model);
  const defaultInstall = ensureModelOn(getWorker(DEFAULT_WORKER), model);
  const otherInstalls: Array<Promise<unknown>> = [];
  for (const [name, entry] of workers) {
    if (name !== DEFAULT_WORKER) {
      otherInstalls.push(ensureModelOn(entry, model));
    }
  }
  await Promise.all(otherInstalls);
  const response = await defaultInstall;
  return response.error ? { error: response.error } : { result: true };
}

export async function loadModelOnWorker(
  model: string,
  worker: WorkerName,
): Promise<{ result?: true; error?: string }> {
  const response = await ensureModelOn(getWorker(worker), model);
  return response.error ? { error: response.error } : { result: true };
}

export async function runR(
  model: string,
  fn: string,
  params?: Record<string, JsonValue>,
  worker: WorkerName = DEFAULT_WORKER,
): Promise<{ result?: unknown; error?: string }> {
  const entry = getWorker(worker);
  const installResult = await ensureModelOn(entry, model);
  if (installResult.error) return { error: installResult.error };
  return requestResponse(entry, {
    type: "run",
    model,
    fn,
    params,
  });
}

export async function warmWorkers(options: {
  workers: WorkerName[];
  models?: string[];
}): Promise<void> {
  const models = options.models ?? [];
  for (const model of models) sharedModels.add(model);
  const installs: Array<Promise<unknown>> = [];
  for (const name of options.workers) {
    const entry = getWorker(name);
    for (const model of models) {
      installs.push(ensureModelOn(entry, model));
    }
  }
  await Promise.all(installs);
}

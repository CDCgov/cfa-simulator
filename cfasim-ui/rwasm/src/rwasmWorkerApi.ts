import { createWorkerPool } from "@cfasim-ui/shared/worker-pool";

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

export type WorkerName = string;

const DEFAULT_WORKER = "default";

const pool = createWorkerPool({
  createWorker: () =>
    new Worker(new URL("./rwasm.worker.ts", import.meta.url), {
      type: "module",
    }),
  loadMessage: (model) => ({ type: "loadModel", model }),
  messageErrorText: "R worker could not deserialize its response",
});

export async function loadModel(
  model: string,
): Promise<{ result?: true; error?: string }> {
  const response = await pool.load(model);
  return response.error ? { error: response.error } : { result: true };
}

export async function loadModelOnWorker(
  model: string,
  worker: WorkerName,
): Promise<{ result?: true; error?: string }> {
  const response = await pool.loadOnWorker(model, worker);
  return response.error ? { error: response.error } : { result: true };
}

export async function runR(
  model: string,
  fn: string,
  params?: Record<string, JsonValue>,
  worker: WorkerName = DEFAULT_WORKER,
): Promise<{ result?: unknown; error?: string }> {
  const installResult = await pool.ensureLoaded(model, worker);
  if (installResult.error) return { error: installResult.error };
  return pool.request(worker, { type: "run", model, fn, params });
}

export function warmWorkers(options: {
  workers: WorkerName[];
  models?: string[];
}): Promise<void> {
  return pool.warm({ workers: options.workers, keys: options.models });
}

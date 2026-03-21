interface WorkerMessage {
  id: number;
  model: string;
  fn: string;
  args: string[];
}

interface WorkerResponse {
  id: number;
  result?: string;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadedModules = new Map<string, Record<string, any>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureModule(model: string): Promise<Record<string, any>> {
  const cached = loadedModules.get(model);
  if (cached) return cached;

  const url = `${self.location.origin}/wasm/${model}/${model}.js`;
  const mod = await import(/* @vite-ignore */ url);
  await mod.default();
  loadedModules.set(model, mod);
  return mod;
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, model, fn, args } = event.data;
  try {
    const t0 = performance.now();
    const mod = await ensureModule(model);
    const result = mod[fn](...args);
    const elapsed = Math.round((performance.now() - t0) * 10) / 10;
    console.log(`[wasm-worker] ${model}.${fn} ${elapsed}ms`);
    self.postMessage({ id, result } as WorkerResponse);
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    } as WorkerResponse);
  }
};

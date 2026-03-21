import {
  postWithTransfer,
  postModelOutputsWithTransfer,
  postErrorWithTransfer,
} from "@cfasim-ui/shared";

interface WorkerMessage {
  id: number;
  model: string;
  fn: string;
  args: string[];
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

    if (result && typeof result === "object" && result.__modelOutputs) {
      // Convert js_sys Arrays to real JS arrays for each output
      const outputs: Record<
        string,
        { length: number; columns: unknown[]; buffers: ArrayBuffer[] }
      > = {};
      for (const [key, wire] of Object.entries(result.outputs)) {
        const w = wire as {
          length: number;
          columns: unknown;
          buffers: unknown;
        };
        outputs[key] = {
          length: w.length,
          columns: Array.from(w.columns as Iterable<unknown>),
          buffers: Array.from(w.buffers as Iterable<unknown>) as ArrayBuffer[],
        };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      postModelOutputsWithTransfer(self, id, {
        __modelOutputs: true,
        outputs,
      } as any);
    } else {
      postWithTransfer(self, id, result);
    }
  } catch (error) {
    postErrorWithTransfer(self, id, error);
  }
};

import {
  postWithTransfer,
  postModelOutputsWithTransfer,
  postErrorWithTransfer,
} from "@cfasim-ui/shared/transfer";
import type { WorkerMessage } from "./messages.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modulePromises = new Map<string, Promise<Record<string, any>>>();

const baseUrl = import.meta.env.BASE_URL ?? "/";

// Injected by the `cfasimWasm` Vite plugin (model name -> hash of the
// wasm-pack output). Absent when an app ships prebuilt wasm without it.
declare const __CFASIM_WASM_VERSIONS__: Record<string, string> | undefined;

function wasmVersion(model: string): string | undefined {
  if (typeof __CFASIM_WASM_VERSIONS__ === "undefined") return undefined;
  return __CFASIM_WASM_VERSIONS__?.[model];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureModule(model: string): Promise<Record<string, any>> {
  if (!modulePromises.has(model)) {
    const promise = (async () => {
      const dir = `${self.location.origin}${baseUrl}wasm/${model}/`;
      const version = wasmVersion(model);
      const query = version ? `?v=${version}` : "";
      const mod = await import(/* @vite-ignore */ `${dir}${model}.js${query}`);
      // The glue resolves `<model>_bg.wasm` against its own URL, which drops
      // the query, so the wasm path is passed explicitly when versioned.
      // The object form needs wasm-bindgen >= 0.2.93.
      if (version) {
        await mod.default({ module_or_path: `${dir}${model}_bg.wasm${query}` });
      } else {
        await mod.default();
      }
      return mod;
    })();
    promise.catch(() => {
      modulePromises.delete(model);
    });
    modulePromises.set(model, promise);
  }
  return modulePromises.get(model)!;
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

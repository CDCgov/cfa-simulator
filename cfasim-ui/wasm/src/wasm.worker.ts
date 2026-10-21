// Subpath imports keep Vue out of the worker: the package barrel re-exports
// `useUrlParams`, which imports it.
import {
  postWithTransfer,
  postModelOutputsWithTransfer,
  postErrorWithTransfer,
} from "@cfasim-ui/shared/transfer";
import {
  describeWasmTrap,
  describeWasmInitTrap,
  isWasmTrap,
} from "@cfasim-ui/shared/workerError";
import type { WorkerMessage } from "./messages.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WasmModule = Record<string, any>;

const modulePromises = new Map<string, Promise<WasmModule>>();

const baseUrl = import.meta.env.BASE_URL ?? "/";

// Injected by the `cfasimWasm` Vite plugin (model name -> hash of the
// wasm-pack output). Absent when an app ships prebuilt wasm without it.
declare const __CFASIM_WASM_VERSIONS__: Record<string, string> | undefined;

function wasmVersion(model: string): string | undefined {
  if (typeof __CFASIM_WASM_VERSIONS__ === "undefined") return undefined;
  return __CFASIM_WASM_VERSIONS__?.[model];
}

function ensureModule(model: string): Promise<WasmModule> {
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
      // Exported by cfasim-model releases after 0.10.0: records each panic's
      // message and location so a trap can be reported as more than
      // "unreachable".
      // Installed after init so it chains onto any hook the model's own
      // start function set.
      mod.__cfasim_install_panic_hook?.();
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
  let mod: WasmModule | undefined;
  try {
    const t0 = performance.now();
    mod = await ensureModule(model);
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
    const trapMessage = error instanceof Error ? error.message : String(error);
    if (isWasmTrap(error) && mod) {
      // A Rust panic (or abort) does not unwind: destructors never ran, so
      // the instance may hold poisoned state. The main thread replaces the
      // worker when it sees `trap`.
      const takePanic = mod.__cfasim_take_panic;
      let panic: string | undefined;
      try {
        panic = takePanic?.() as string | undefined;
      } catch {
        // Reading the string allocates, which can trap again after an OOM.
      }
      const message = describeWasmTrap(trapMessage, panic, !!takePanic);
      console.error(`[wasm-worker] ${model}.${fn} failed: ${message}`, error);
      postErrorWithTransfer(self, id, new Error(message), { trap: "call" });
      return;
    }
    if (isWasmTrap(error)) {
      // The glue stores the instance before running the start function and
      // returns it to every later init call, so a trap in init can only be
      // retried in a new worker.
      const message = describeWasmInitTrap(trapMessage);
      console.error(`[wasm-worker] ${model}.${fn} failed: ${message}`, error);
      postErrorWithTransfer(self, id, new Error(message), { trap: "init" });
      return;
    }
    console.error(`[wasm-worker] ${model}.${fn} failed:`, error);
    postErrorWithTransfer(self, id, error);
  }
};

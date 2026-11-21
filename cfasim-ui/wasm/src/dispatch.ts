import type { WorkerMessage } from "./messages.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WasmModule = Record<string, any>;

const namedInputFunctions = new WeakMap<WasmModule, Set<string>>();
const warnedPositional = new Set<string>();

/** The functions `cfasim_model::export!` exported, which take named inputs. */
function takesNamedInputs(mod: WasmModule, fn: string): boolean {
  let names = namedInputFunctions.get(mod);
  if (!names) {
    const list = mod.__cfasim_named_inputs?.() as string | undefined;
    names = new Set(list ? list.split(",") : []);
    namedInputFunctions.set(mod, names);
  }
  return names.has(fn);
}

/**
 * Call a model function with the convention it was exported with: one JSON
 * object of named inputs, or positional arguments.
 */
export function callModelFunction(
  mod: WasmModule,
  message: Pick<WorkerMessage, "model" | "fn" | "args" | "inputs">,
): unknown {
  const { model, fn, args, inputs } = message;
  if (typeof mod[fn] !== "function") {
    throw new Error(`Model ${model} has no function ${fn}`);
  }
  if (inputs === undefined) return mod[fn](...args);
  if (takesNamedInputs(mod, fn)) return mod[fn](JSON.parse(inputs));

  const key = `${model}.${fn}`;
  if (!warnedPositional.has(key)) {
    warnedPositional.add(key);
    console.warn(
      `[wasm-worker] ${key} takes positional arguments, so the keys of its ` +
        `params object must be in the order of the Rust signature. Export ` +
        `it with cfasim_model::export! to match inputs by name.`,
    );
  }
  return mod[fn](...args);
}

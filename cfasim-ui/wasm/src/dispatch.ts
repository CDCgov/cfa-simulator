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
 * Remove `undefined` values (a cleared input) in place, so they count as
 * missing fields like they would in JSON: `#[serde(default)]` applies, and
 * the error for a required field names it.
 */
function dropUndefined(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) dropUndefined(item);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  if (Object.getPrototypeOf(value) !== Object.prototype) return;
  const object = value as Record<string, unknown>;
  for (const key of Object.keys(object)) {
    if (object[key] === undefined) delete object[key];
    else dropUndefined(object[key]);
  }
}

/**
 * Call a model function with the convention it was exported with: one
 * object of named inputs, or positional arguments.
 */
export function callModelFunction(
  mod: WasmModule,
  message: Pick<WorkerMessage, "model" | "fn" | "args" | "inputs">,
): unknown {
  const { model, fn, args = [], inputs } = message;
  if (typeof mod[fn] !== "function") {
    throw new Error(`Model ${model} has no function ${fn}`);
  }
  if (inputs === undefined) return mod[fn](...args);
  if (takesNamedInputs(mod, fn)) {
    dropUndefined(inputs);
    return mod[fn](inputs);
  }

  const values = Object.values(inputs);
  const key = `${model}.${fn}`;
  // A single value cannot be out of order.
  if (values.length > 1 && !warnedPositional.has(key)) {
    warnedPositional.add(key);
    console.warn(
      `[wasm-worker] ${key} takes positional arguments, so the keys of its ` +
        `params object must be in the order of the Rust signature. Export ` +
        `it with cfasim_model::export! to match inputs by name.`,
    );
  }
  return mod[fn](...values.map(String));
}

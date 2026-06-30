import { ref, toRaw, toValue, watch } from "vue";
import type { MaybeRef } from "vue";
import type { ModelOutput } from "./ModelOutput.js";

/** Result of loading a model / running a function: one of `result` / `error`. */
export interface RuntimeResult {
  result?: unknown;
  error?: string;
}

/**
 * The minimal runtime surface a `useModel` composable needs: load a model by
 * name, then call one of its functions with named params. Implemented by the
 * Pyodide (`loadModule`/`callPython`) and rwasm (`loadModel`/`runR`) packages.
 */
export interface ModelRuntime {
  load: (model: string) => Promise<RuntimeResult>;
  run: (
    model: string,
    fn: string,
    params?: Record<string, unknown>,
  ) => Promise<RuntimeResult>;
}

/** Strip Vue reactivity from each param value before crossing the worker boundary. */
function plainParams(
  params: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, toRaw(value)]),
  );
}

/**
 * Build a `useModel` composable bound to a `ModelRuntime`. The returned hook
 * loads the model once, then exposes an imperative `run` and a reactive
 * `useOutputs` that re-runs whenever its params change.
 */
export function createUseModel(runtime: ModelRuntime) {
  return function useModel<T = unknown>(modelName: string) {
    const result = ref<T>();
    const error = ref<string>();
    const loading = ref(true);

    const loaded = runtime.load(modelName);
    loaded.then((response) => {
      if (response.error) error.value = response.error;
      loading.value = false;
    });

    async function run(fn: string, params?: Record<string, unknown>) {
      loading.value = true;
      error.value = undefined;
      try {
        await loaded;
        const response = await runtime.run(modelName, fn, plainParams(params));
        if (response.error) {
          error.value = response.error;
        } else {
          result.value = response.result as T;
        }
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
      } finally {
        loading.value = false;
      }
    }

    function useOutputs<P extends Record<string, unknown>>(
      fn: string,
      params: MaybeRef<P>,
    ) {
      const outputs = ref<Record<string, ModelOutput>>();
      const outputsError = ref<string>();
      const outputsLoading = ref(true);

      watch(
        () => toValue(params),
        async (p) => {
          outputsLoading.value = true;
          outputsError.value = undefined;
          try {
            await loaded;
            const response = await runtime.run(modelName, fn, plainParams(p));
            if (response.error) {
              outputsError.value = response.error;
            } else {
              outputs.value = response.result as Record<string, ModelOutput>;
            }
          } catch (e) {
            outputsError.value = e instanceof Error ? e.message : String(e);
          } finally {
            outputsLoading.value = false;
          }
        },
        { immediate: true, deep: true },
      );

      return { outputs, error: outputsError, loading: outputsLoading };
    }

    return { run, result, error, loading, useOutputs };
  };
}

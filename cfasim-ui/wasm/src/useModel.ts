import { ref, toValue, watch } from "vue";
import type { MaybeRef } from "vue";
import type { ModelOutput } from "@cfasim-ui/shared";
import { callWasm, runWasm } from "./wasmWorkerApi.js";

export function useModel<T = unknown>(model: string) {
  const result = ref<T>();
  const error = ref<string>();
  const loading = ref(false);

  /** Call `fn` with named inputs, or with positional arguments. */
  function run(fn: string, inputs: Record<string, unknown>): Promise<void>;
  function run(fn: string, ...args: (string | number)[]): Promise<void>;
  async function run(fn: string, ...args: unknown[]) {
    loading.value = true;
    error.value = undefined;
    try {
      const [first] = args;
      const call =
        typeof first === "object" && first !== null
          ? callWasm(model, fn, first as Record<string, unknown>)
          : runWasm(model, fn, ...args.map(String));
      result.value = (await call) as T;
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
    const outputsLoading = ref(false);

    watch(
      () => toValue(params),
      async (p) => {
        outputsLoading.value = true;
        outputsError.value = undefined;
        try {
          const res = await callWasm(model, fn, p);
          outputs.value = res as Record<string, ModelOutput>;
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
}

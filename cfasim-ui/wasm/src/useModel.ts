import { ref, toValue, watch } from "vue";
import type { MaybeRef } from "vue";
import type { ModelOutput } from "@cfasim-ui/shared";
import { runWasm } from "./wasmWorkerApi.js";

export function useModel<T = unknown>(model: string) {
  const result = ref<T>();
  const error = ref<string>();
  const loading = ref(false);

  async function run(fn: string, ...args: (string | number)[]) {
    loading.value = true;
    error.value = undefined;
    try {
      result.value = (await runWasm(model, fn, ...args.map(String))) as T;
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
          const args = Object.values(p).map(String);
          const res = await runWasm(model, fn, ...args);
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

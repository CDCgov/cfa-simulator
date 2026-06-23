import { ref, toRaw, toValue, watch } from "vue";
import type { MaybeRef } from "vue";
import type { ModelOutput } from "@cfasim-ui/shared";
import { loadModel, runR } from "./rwasmWorkerApi.js";
import type { JsonValue } from "./rwasmWorkerApi.js";

function plainParams(
  params: Record<string, JsonValue> | undefined,
): Record<string, JsonValue> | undefined {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, toRaw(value)]),
  ) as Record<string, JsonValue>;
}

export function useModel<T = unknown>(modelName: string) {
  const result = ref<T>();
  const error = ref<string>();
  const loading = ref(true);

  const loaded = loadModel(modelName);
  loaded.then((response) => {
    if (response.error) error.value = response.error;
    loading.value = false;
  });

  async function run(fn: string, params?: Record<string, JsonValue>) {
    loading.value = true;
    error.value = undefined;
    try {
      await loaded;
      const response = await runR(modelName, fn, plainParams(params));
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

  function useOutputs<P extends Record<string, JsonValue>>(
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
          const response = await runR(modelName, fn, plainParams(p));
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
}

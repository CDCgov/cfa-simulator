import { ref, toRaw, toValue, watch } from "vue";
import type { MaybeRef } from "vue";
import type { ModelOutput } from "@cfasim-ui/shared";
import { callPython, loadModule } from "./pyodideWorkerApi.js";

function plainKwargs(
  ctx: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!ctx) return undefined;
  return Object.fromEntries(Object.entries(ctx).map(([k, v]) => [k, toRaw(v)]));
}

export function useModel<T = unknown>(moduleName: string) {
  const result = ref<T>();
  const error = ref<string>();
  const loading = ref(true);

  const loaded = loadModule(moduleName);
  loaded.then(() => {
    loading.value = false;
  });

  async function run(fn: string, context?: Record<string, unknown>) {
    loading.value = true;
    error.value = undefined;
    try {
      await loaded;
      const response = await callPython(moduleName, fn, plainKwargs(context));
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
          const response = await callPython(moduleName, fn, plainKwargs(p));
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

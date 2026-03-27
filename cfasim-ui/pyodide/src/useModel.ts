import { ref, toRaw, toValue, watch } from "vue";
import type { MaybeRef } from "vue";
import type { ModelOutput } from "@cfasim-ui/shared";
import { asyncRunPython, loadModule } from "./pyodideWorkerApi.js";

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
      const argNames = context ? Object.keys(context) : [];
      const callArgs = argNames.join(", ");
      const plainContext = context
        ? Object.fromEntries(
            Object.entries(context).map(([k, v]) => [k, toRaw(v)]),
          )
        : undefined;
      const response = await asyncRunPython(
        `import ${moduleName}\n${moduleName}.${fn}(${callArgs})`,
        plainContext,
      );
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
          const plain = Object.fromEntries(
            Object.entries(p).map(([k, v]) => [k, toRaw(v)]),
          );
          const argNames = Object.keys(plain);
          const callArgs = argNames.join(", ");
          const response = await asyncRunPython(
            `import ${moduleName}\n${moduleName}.${fn}(${callArgs})`,
            plain,
          );
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

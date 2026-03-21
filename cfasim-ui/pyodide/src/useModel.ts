import { ref, onMounted } from "vue";
import { asyncRunPython, loadModule } from "./pyodideWorkerApi.js";

export function useModel(
  moduleName: string,
  fn: string,
  args?: Record<string, unknown>,
) {
  const result = ref<unknown>();
  const error = ref<string>();
  const loading = ref(true);

  const loaded = loadModule(moduleName);

  onMounted(async () => {
    try {
      await loaded;
      const response = await asyncRunPython(
        `import ${moduleName}\n${moduleName}.${fn}()`,
        args,
      );
      if (response.error) {
        error.value = response.error;
      } else {
        result.value = response.result;
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  });

  return { result, error, loading };
}

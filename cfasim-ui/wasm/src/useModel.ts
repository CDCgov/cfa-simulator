import { ref, onMounted } from "vue";
import { runWasm } from "./wasmWorkerApi.js";

export function useModel(model: string, fn: string, ...args: string[]) {
  const result = ref<string>();
  const error = ref<string>();
  const loading = ref(true);

  onMounted(async () => {
    try {
      result.value = await runWasm(model, fn, ...args);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  });

  return { result, error, loading };
}

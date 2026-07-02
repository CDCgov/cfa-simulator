import { reactive } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUrlParams } from "@cfasim-ui/shared";

/**
 * Model-page params: a `reactive` copy of `defaults` synced to the URL
 * query string via `useUrlParams` on this app's router.
 */
export function useModelParams<T extends object>(defaults: T) {
  const params = reactive({ ...defaults });
  const { reset } = useUrlParams(params, defaults, {
    router: useRouter(),
    route: useRoute(),
  });
  return { params, reset };
}

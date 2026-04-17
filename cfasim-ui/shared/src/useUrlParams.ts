import { watch, onMounted, onUnmounted, isRef, type Ref } from "vue";

/**
 * Minimal shape of vue-router's `Router` that `useUrlParams` needs.
 * Typed structurally so `@cfasim-ui/shared` does not depend on vue-router.
 */
export interface UrlParamsRouter {
  replace(to: { query: Record<string, string> }): unknown;
}

/**
 * Minimal shape of vue-router's `RouteLocationNormalized` that
 * `useUrlParams` reads to hydrate initial state.
 */
export interface UrlParamsRoute {
  query: Record<string, unknown>;
}

export type UrlParamsOptions = {
  debounceMs?: number;
  /**
   * Optional vue-router integration. Pass `useRouter()` and `useRoute()` from
   * the calling component. When provided, URL reads/writes go through the
   * router so `route.query` stays reactive. When omitted, the composable
   * uses the browser History API directly.
   */
  router?: UrlParamsRouter;
  route?: UrlParamsRoute;
};

export function serialize(value: unknown): string {
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}

export function deserialize(raw: string, defaultValue: unknown): unknown {
  if (typeof defaultValue === "boolean") return raw === "true";
  if (typeof defaultValue === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? defaultValue : n;
  }
  if (Array.isArray(defaultValue)) {
    return raw.split(",").map((s) => {
      const n = Number(s);
      return Number.isNaN(n) ? s : n;
    });
  }
  return raw;
}

export function paramsToQuery<T extends object>(
  params: T,
  defaults: T,
): Record<string, string> {
  const query: Record<string, string> = {};
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const serialized = serialize(params[key]);
    const defaultSerialized = serialize(defaults[key]);
    if (serialized !== defaultSerialized) {
      query[key] = serialized;
    }
  }
  return query;
}

export function queryToParams<T extends object>(
  query: Record<string, unknown>,
  defaults: T,
): Partial<T> {
  const result: Record<string, unknown> = {};
  const defaultsRecord = defaults as Record<string, unknown>;
  for (const [key, raw] of Object.entries(query)) {
    if (!(key in defaultsRecord)) continue;
    if (typeof raw !== "string") continue;
    result[key] = deserialize(raw, defaultsRecord[key]);
  }
  return result as Partial<T>;
}

function readLocationQuery(): Record<string, string> {
  const out: Record<string, string> = {};
  const search = new URLSearchParams(window.location.search);
  for (const [k, v] of search) out[k] = v;
  return out;
}

function writeLocationQuery(query: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) params.set(k, v);
  const qs = params.toString();
  const url =
    window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
  // Preserve whatever state object the current history entry holds (vue-router
  // stores its own bookkeeping there) so we don't clobber it.
  window.history.replaceState(window.history.state, "", url);
}

/**
 * Syncs a reactive params object with the URL query string.
 * Only values that differ from defaults appear in the URL.
 * On mount, applies any overrides from the current query string.
 * Accepts either a `ref()` or a `reactive()` object.
 *
 * By default, uses the browser History API directly. Consumers using
 * vue-router can pass `{ router: useRouter(), route: useRoute() }` so that
 * `route.query` stays reactive.
 */
export function useUrlParams<T extends object>(
  params: T | Ref<T>,
  defaults: T,
  options: UrlParamsOptions = {},
) {
  const debounceMs = options.debounceMs ?? 300;
  const { router, route } = options;

  function readQuery(): Record<string, unknown> {
    if (route) return route.query;
    return readLocationQuery();
  }

  function writeQuery(query: Record<string, string>) {
    if (router) {
      router.replace({ query });
    } else {
      writeLocationQuery(query);
    }
  }

  function read(): T {
    return isRef(params) ? params.value : params;
  }

  function apply(overrides: Partial<T>) {
    const merged = { ...structuredClone(defaults), ...overrides } as T;
    if (isRef(params)) {
      params.value = merged;
    } else {
      Object.assign(params, merged);
    }
  }

  let hydrated = false;

  onMounted(() => {
    const overrides = queryToParams(readQuery(), defaults);
    if (Object.keys(overrides).length > 0) {
      apply(overrides);
    }
    hydrated = true;
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  watch(
    () => read(),
    () => {
      if (!hydrated) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        writeQuery(paramsToQuery(read(), defaults));
      }, debounceMs);
    },
    { deep: true },
  );

  function reset() {
    apply({});
    if (debounceTimer) clearTimeout(debounceTimer);
    writeQuery({});
  }

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  return { reset };
}

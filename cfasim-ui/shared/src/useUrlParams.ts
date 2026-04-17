import { isRef, onMounted, onUnmounted, toRaw, watch, type Ref } from "vue";

/**
 * Minimal shape of vue-router's `Router` that `useUrlParams` needs.
 * Typed structurally so `@cfasim-ui/shared` does not depend on vue-router.
 */
export interface UrlParamsRouter {
  replace(to: { query: Record<string, string> }): unknown;
}

/**
 * Minimal shape of vue-router's `RouteLocationNormalized` that
 * `useUrlParams` reads to hydrate initial state. `query` is typed as
 * `Record<string, unknown>` because vue-router yields `string | string[] |
 * null`; `deserialize` silently ignores non-string entries.
 */
export interface UrlParamsRoute {
  query: Record<string, unknown>;
}

/**
 * Defaults can be:
 *  - a plain object (sync, always available),
 *  - a Ref<T> (reactive; useful when defaults are computed),
 *  - a getter `() => T | undefined` (useful for async loads; return
 *    `undefined` until defaults are ready, then call `hydrate()` from
 *    the consumer).
 */
export type DefaultsInput<T> = T | Ref<T> | (() => T | undefined);

export type UrlParamsOptions<T> = {
  debounceMs?: number;
  /**
   * Optional vue-router integration. Pass `useRouter()` and `useRoute()` from
   * the calling component. When provided, URL reads/writes go through the
   * router so `route.query` stays reactive. When omitted, the composable
   * uses the browser History API directly.
   */
  router?: UrlParamsRouter;
  route?: UrlParamsRoute;
  /**
   * Only sync these keys. Useful when `defaults` contains labels, flags, or
   * other fields the user never edits.
   */
  include?: (keyof T)[];
  /**
   * Sync all keys except these. Ignored if `include` is provided.
   */
  ignore?: (keyof T)[];
};

export type ResetOptions = {
  /** Whether to clear the URL query in addition to resetting params. Default: true. */
  clearUrl?: boolean;
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

function toGetter<T>(input: DefaultsInput<T>): () => T | undefined {
  if (typeof input === "function") return input as () => T | undefined;
  if (isRef(input)) return () => (input as Ref<T>).value;
  return () => input as T;
}

function filterKeys<T extends object>(
  obj: T,
  include?: (keyof T)[],
  ignore?: (keyof T)[],
): T {
  if (!include && !ignore) return obj;
  const src = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src)) {
    const key = k as keyof T;
    if (include) {
      if (include.includes(key)) out[k] = src[k];
    } else if (ignore) {
      if (!ignore.includes(key)) out[k] = src[k];
    } else {
      out[k] = src[k];
    }
  }
  return out as T;
}

/**
 * Syncs a reactive params object with the URL query string. Only values
 * that differ from defaults appear in the URL. Accepts either a `ref()`
 * or a `reactive()` object.
 *
 * For async defaults (e.g. loaded from WASM/network), pass a getter or ref
 * that returns `undefined` until ready, and call `hydrate()` once defaults
 * are available. The composable also attempts hydration on mount; the
 * first successful attempt "locks in" writes going forward.
 *
 * Browser back/forward and external `route.query` changes are picked up
 * automatically (via `popstate` or a route watcher).
 *
 * By default, uses the browser History API directly. Consumers using
 * vue-router can pass `{ router: useRouter(), route: useRoute() }` so that
 * `route.query` stays reactive.
 */
export function useUrlParams<T extends object>(
  params: T | Ref<T>,
  defaults: DefaultsInput<T>,
  options: UrlParamsOptions<T> = {},
) {
  const debounceMs = options.debounceMs ?? 300;
  const { router, route, include, ignore } = options;
  const getDefaults = toGetter<T>(defaults);
  const scopedDefaults = (): T | undefined => {
    const d = getDefaults();
    return d === undefined ? undefined : filterKeys(d, include, ignore);
  };

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

  function apply(overrides: Partial<T>, d: T) {
    // Layer order (later wins): current params -> defaults -> URL overrides.
    // Starting from current preserves keys outside the sync scope (i.e.
    // those filtered out by `include`/`ignore`), which matters when `params`
    // is a ref and the whole object gets replaced below. `toRaw` unwraps
    // reactive proxies so `structuredClone` doesn't choke.
    const current = toRaw(read());
    const merged = {
      ...structuredClone(current),
      ...structuredClone(toRaw(d)),
      ...overrides,
    } as T;
    if (isRef(params)) {
      params.value = merged;
    } else {
      Object.assign(params, merged);
    }
  }

  let hydrated = false;

  function hydrate(): boolean {
    const d = scopedDefaults();
    if (d === undefined) return false;
    const overrides = queryToParams(readQuery(), d);
    if (Object.keys(overrides).length > 0) apply(overrides, d);
    hydrated = true;
    return true;
  }

  function syncFromUrl() {
    if (!hydrated) {
      hydrate();
      return;
    }
    const d = scopedDefaults();
    if (d === undefined) return;
    const overrides = queryToParams(readQuery(), d);
    apply(overrides, d);
  }

  onMounted(() => {
    hydrate();
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  watch(
    () => read(),
    () => {
      if (!hydrated) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const d = scopedDefaults();
        if (d === undefined) return;
        writeQuery(paramsToQuery(read(), d));
      }, debounceMs);
    },
    { deep: true },
  );

  // React to external query changes (back/forward, programmatic nav).
  let stopRouteWatch: (() => void) | null = null;
  function onPopState() {
    syncFromUrl();
  }
  onMounted(() => {
    if (route) {
      stopRouteWatch = watch(
        () => route.query,
        () => syncFromUrl(),
        { deep: true },
      );
    } else {
      window.addEventListener("popstate", onPopState);
    }
  });
  onUnmounted(() => {
    if (stopRouteWatch) stopRouteWatch();
    else window.removeEventListener("popstate", onPopState);
  });

  function reset(opts: ResetOptions = {}) {
    const { clearUrl = true } = opts;
    const d = scopedDefaults();
    if (d === undefined) return;
    apply({}, d);
    if (clearUrl) {
      if (debounceTimer) clearTimeout(debounceTimer);
      writeQuery({});
    }
  }

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  return { reset, hydrate };
}

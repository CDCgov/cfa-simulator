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

/**
 * A path into the params object. Either a top-level key (autocompleted from
 * `T`) or a dotted path to a nested leaf (`"nested.foo"`). Matches the leaf
 * exactly or any descendant when used as `include`/`ignore`.
 */
export type ParamPath<T> = keyof T | (string & {});

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
   * Only sync these paths. Accepts top-level keys or dotted paths to nested
   * leaves; a parent path implicitly covers all of its descendants.
   */
  include?: ParamPath<T>[];
  /**
   * Sync all paths except these. Same matching rules as `include`. Ignored
   * if `include` is provided.
   */
  ignore?: ParamPath<T>[];
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

// A "container" is any non-null object — plain object or array. A "branch"
// is a container we recurse into when flattening defaults: plain objects
// always recurse; arrays only recurse when at least one element is itself a
// plain object (so `[1, 2, 3]` stays a comma-joined leaf, while
// `[{foo: 1}, {foo: 2}]` becomes `items.0.foo=…&items.1.foo=…`).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isContainer(
  value: unknown,
): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === "object";
}

function isBranch(value: unknown): boolean {
  if (isPlainObject(value)) return true;
  // Recurse into arrays whose elements are themselves containers (plain
  // objects or arrays), so array-of-arrays and array-of-objects map onto
  // indexed dotted paths. Arrays of primitives stay as comma-joined leaves.
  if (Array.isArray(value)) return value.some(isContainer);
  return false;
}

function* flattenLeaves(
  obj: Record<string, unknown> | unknown[],
  prefix: string[] = [],
): Generator<[string[], unknown]> {
  const entries: Array<[string, unknown]> = Array.isArray(obj)
    ? obj.map((v, i) => [String(i), v])
    : Object.entries(obj);
  for (const [k, v] of entries) {
    const path = [...prefix, k];
    if (isBranch(v)) {
      yield* flattenLeaves(v as Record<string, unknown> | unknown[], path);
    } else {
      yield [path, v];
    }
  }
}

function getAtSegments(obj: unknown, segments: string[]): unknown {
  let cur: unknown = obj;
  for (const p of segments) {
    if (!isContainer(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

// Sets `value` at `segments` inside `obj`. When `defaults` is supplied,
// missing intermediate slots match the defaults' shape (array vs object) at
// the same path — so a URL like `items.0.foo=5` rebuilds an array, not an
// object with numeric keys.
function setAtSegments(
  obj: Record<string, unknown> | unknown[],
  segments: string[],
  value: unknown,
  defaults?: unknown,
): void {
  let cur: Record<string, unknown> | unknown[] = obj;
  let defCur: unknown = defaults;
  for (let i = 0; i < segments.length - 1; i++) {
    const p = segments[i];
    const defNext = isContainer(defCur)
      ? (defCur as Record<string, unknown>)[p]
      : undefined;
    const slot = (cur as Record<string, unknown>)[p];
    if (!isContainer(slot)) {
      (cur as Record<string, unknown>)[p] = Array.isArray(defNext) ? [] : {};
    }
    cur = (cur as Record<string, unknown>)[p] as
      | Record<string, unknown>
      | unknown[];
    defCur = defNext;
  }
  (cur as Record<string, unknown>)[segments[segments.length - 1]] = value;
}

// Encode/decode segment arrays to/from URL query keys. Each segment is
// percent-encoded so a literal `.` inside a key name won't collide with the
// nesting separator. `encodeURIComponent` leaves `.` alone, so we replace
// it manually to `%2E`. The encoded key still passes cleanly through
// `URLSearchParams` and vue-router.
function encodeKey(segments: string[]): string {
  return segments
    .map((s) => encodeURIComponent(s).replace(/\./g, "%2E"))
    .join(".");
}

function decodeKey(key: string): string[] {
  return key.split(".").map(decodeURIComponent);
}

// Recursive merge used to layer defaults onto the cloned current params.
// Descends into matching containers (objects and arrays) so sibling
// branches survive. URL overrides bypass this and use `setAtSegments`
// directly, since a comma-encoded leaf array must replace its slot
// wholesale rather than merge element-wise with the default.
function deepMerge(
  target: Record<string, unknown> | unknown[],
  source: Record<string, unknown> | unknown[],
): Record<string, unknown> | unknown[] {
  for (const [k, v] of Object.entries(source)) {
    const slot = (target as Record<string, unknown>)[k];
    if (isContainer(v) && isContainer(slot)) {
      deepMerge(slot, v);
    } else {
      (target as Record<string, unknown>)[k] = v;
    }
  }
  return target;
}

export function paramsToQuery<T extends object>(
  params: T,
  defaults: T,
): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [segments, defaultLeaf] of flattenLeaves(
    defaults as Record<string, unknown>,
  )) {
    const paramLeaf = getAtSegments(params, segments);
    if (paramLeaf === undefined) continue;
    const serialized = serialize(paramLeaf);
    const defaultSerialized = serialize(defaultLeaf);
    if (serialized !== defaultSerialized) {
      query[encodeKey(segments)] = serialized;
    }
  }
  return query;
}

export function queryToParams<T extends object>(
  query: Record<string, unknown>,
  defaults: T,
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(query)) {
    if (typeof raw !== "string") continue;
    const segments = decodeKey(key);
    const defaultLeaf = getAtSegments(defaults, segments);
    // Drop unknown dotted keys: matches the flat behavior and keeps the
    // params shape stable.
    if (defaultLeaf === undefined) continue;
    setAtSegments(result, segments, deserialize(raw, defaultLeaf), defaults);
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

// `include`/`ignore` entries are dotted strings using `.` as a JS-side path
// separator (one segment per key). A path is in scope iff it (or any
// ancestor) matches an include entry, or it (and all its ancestors) avoid
// every ignore entry. `include` wins when both are supplied.
function segmentsStartWith(path: string[], prefix: string[]): boolean {
  if (prefix.length > path.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (path[i] !== prefix[i]) return false;
  }
  return true;
}

function pathInScope(
  path: string[],
  include?: string[][],
  ignore?: string[][],
): boolean {
  if (include) return include.some((entry) => segmentsStartWith(path, entry));
  if (ignore) return !ignore.some((entry) => segmentsStartWith(path, entry));
  return true;
}

function filterDefaults<T extends object>(
  obj: T,
  include?: string[][],
  ignore?: string[][],
): T {
  if (!include && !ignore) return obj;
  const out: Record<string, unknown> = {};
  for (const [path, leaf] of flattenLeaves(obj as Record<string, unknown>)) {
    if (pathInScope(path, include, ignore)) {
      setAtSegments(out, path, leaf, obj);
    }
  }
  return out as T;
}

/**
 * Syncs a reactive params object with the URL query string. Only values
 * that differ from defaults appear in the URL. Accepts either a `ref()`
 * or a `reactive()` object. Nested objects are encoded as dotted keys
 * (`nested.foo=5`); arrays of primitives remain comma-joined leaves.
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
  const includeSegments = include?.map((e) => String(e).split("."));
  const ignoreSegments = ignore?.map((e) => String(e).split("."));
  const getDefaults = toGetter<T>(defaults);
  const scopedDefaults = (): T | undefined => {
    const d = getDefaults();
    return d === undefined
      ? undefined
      : filterDefaults(d, includeSegments, ignoreSegments);
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

  function apply(overrides: Array<[string[], unknown]>, d: T) {
    // Layer order (later wins): current params -> defaults -> URL overrides.
    // Starting from current preserves keys outside the sync scope (i.e.
    // those filtered out by `include`/`ignore`), which matters when `params`
    // is a ref and the whole object gets replaced below. Defaults deep-merge
    // so sibling branches survive; URL overrides are applied at leaf
    // precision so a leaf array like `tags=1,2` replaces the whole leaf
    // instead of merging element-wise with the default array.
    const current = structuredClone(toRaw(read())) as Record<string, unknown>;
    deepMerge(current, structuredClone(toRaw(d)) as Record<string, unknown>);
    for (const [segments, value] of overrides) {
      setAtSegments(current, segments, value, d);
    }
    const merged = current as T;
    if (isRef(params)) {
      params.value = merged;
    } else {
      Object.assign(params, merged);
    }
  }

  function readOverrides(d: T): Array<[string[], unknown]> {
    const out: Array<[string[], unknown]> = [];
    for (const [key, raw] of Object.entries(readQuery())) {
      if (typeof raw !== "string") continue;
      const segments = decodeKey(key);
      const defaultLeaf = getAtSegments(d, segments);
      if (defaultLeaf === undefined) continue;
      out.push([segments, deserialize(raw, defaultLeaf)]);
    }
    return out;
  }

  let hydrated = false;

  function hydrate(): boolean {
    const d = scopedDefaults();
    if (d === undefined) return false;
    const overrides = readOverrides(d);
    if (overrides.length > 0) apply(overrides, d);
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
    apply(readOverrides(d), d);
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
    apply([], d);
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

# Shared

`@cfasim-ui/shared` contains framework-agnostic utilities and Vue composables that are reused across the other cfasim-ui packages.

## useUrlParams

Syncs a reactive params object with the URL query string.

- On mount: reads `route.query` and overrides any matching defaults.
- On change: debounces for 300ms, then calls `router.replace({ query })` with only the values that differ from defaults. Default values are omitted to keep URLs short.
- Reacts to browser back/forward and external `route.query` changes (via `popstate` or a route watcher).
- Returns `{ reset, hydrate }`:
  - `reset(opts?)` — resets synced params to defaults. Clears the URL query by default; pass `{ clearUrl: false }` to leave the URL alone.
  - `hydrate()` — manually re-applies the current query onto params. Returns `true` once defaults are available, `false` while still waiting (see [Async defaults](#async-defaults)).

### Usage

By default, `useUrlParams` reads and writes the URL using the browser's History API directly — no router dependency.

```vue
<script setup lang="ts">
import { reactive } from "vue";
import { useUrlParams } from "@cfasim-ui/shared";

const defaults = { population: 20, p: 0.1, enabled: false };
const params = reactive({ ...defaults });
const { reset } = useUrlParams(params, defaults);
</script>
```

It also accepts a `ref()` in place of a `reactive()` object.

### With vue-router

If your app uses vue-router and you want `route.query` to stay reactive, pass the router and route in:

```vue
<script setup lang="ts">
import { reactive } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useUrlParams } from "@cfasim-ui/shared";

const defaults = { population: 20, p: 0.1 };
const params = reactive({ ...defaults });
const { reset } = useUrlParams(params, defaults, {
  router: useRouter(),
  route: useRoute(),
});
</script>
```

Without this, the History API path still updates the URL bar, but vue-router's cached `route.query` will be stale until the next navigation.

### Type coercion

Query strings are always strings, so deserialization is driven by the type of each default value:

| Default type | Example URL     | Parsed as              |
| ------------ | --------------- | ---------------------- |
| `number`     | `?n=3.14`       | `3.14` (NaN → default) |
| `boolean`    | `?on=true`      | `true`                 |
| `string`     | `?metric=covid` | `"covid"`              |
| `number[]`   | `?k=10,20,30`   | `[10, 20, 30]`         |

### Options

| Option       | Type          | Default | Purpose                                                                |
| ------------ | ------------- | ------- | ---------------------------------------------------------------------- |
| `debounceMs` | `number`      | `300`   | How long to wait after a param change before writing URL.              |
| `router`     | `Router`      | —       | Optional vue-router `useRouter()` instance.                            |
| `route`      | `Route`       | —       | Optional vue-router `useRoute()` instance.                             |
| `include`    | `(keyof T)[]` | —       | Only sync these keys. Other keys are left entirely out of the URL.     |
| `ignore`     | `(keyof T)[]` | —       | Sync everything except these keys. Ignored when `include` is provided. |

Use `include`/`ignore` when `defaults` contains fields the user never edits (labels, UI flags) or ephemeral state you want to keep out of the URL. Keys filtered out are also preserved across `hydrate()` and `reset()`, even when `params` is a `ref()` (whose whole object gets replaced on write).

### Restricting which keys sync

```vue
<script setup lang="ts">
const defaults = { population: 20, p: 0.1, label: "Run 1", debug: false };
const params = reactive({ ...defaults });
useUrlParams(params, defaults, { ignore: ["label", "debug"] });
</script>
```

### Async defaults

If the initial defaults come from an async source (WASM, network), pass a getter that returns `undefined` until ready, and call `hydrate()` when they arrive:

```vue
<script setup lang="ts">
const params = reactive<Params>({} as Params);
let defaults: Params | undefined;
const { hydrate } = useUrlParams(params, () => defaults);

onMounted(async () => {
  defaults = await loadDefaults();
  Object.assign(params, defaults);
  hydrate(); // re-apply any URL overrides now that defaults exist
});
</script>
```

You can also pass a `Ref<T>` as defaults if they are reactive.

### Reset button

Pair the returned `reset` with a Button to restore defaults:

```vue
<Button variant="secondary" @click="() => reset()">Reset</Button>
```

Pass `{ clearUrl: false }` to reset params in place without touching the URL (e.g. when another part of the app is about to navigate).

### Caveats

- No versioning — if you rename a param, old URLs silently drop it.
- Arrays are serialized as comma-separated strings; values containing commas will be split incorrectly.
- Async-initialized params (e.g. values derived from a fetch) need care: check whether the param was already hydrated from the URL before overwriting it.
- Assumes history-mode routing. In hash mode (`createWebHashHistory`), the query lives inside `location.hash`, which the History-API path does not read. Pass vue-router in to handle that case.

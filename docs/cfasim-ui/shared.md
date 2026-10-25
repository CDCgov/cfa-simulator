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

### Nested params

Defaults can be nested objects (or arrays of objects). Each leaf is mapped to a dotted URL key:

```ts
const defaults = {
  beta: 0.3,
  groups: { adults: { size: 100 }, kids: { size: 50 } },
  interventions: [
    { name: "vax", coverage: 0.5 },
    { name: "masks", coverage: 0.3 },
  ],
};
```

| Param change                     | URL                             |
| -------------------------------- | ------------------------------- |
| `groups.adults.size = 200`       | `?groups.adults.size=200`       |
| `interventions[1].coverage = .9` | `?interventions.1.coverage=0.9` |

Only changed leaves appear in the URL, so partial updates to one branch leave sibling values out. Plain non-null objects recurse as branches; arrays of primitives stay as comma-joined leaves (`?tags=1,2,3`); arrays whose elements are objects recurse with numeric indices. Key segments containing a literal `.` are percent-encoded (`%2E`) so they survive the round trip.

`include` / `ignore` accept dotted strings (`"groups.adults.size"`); a parent path implicitly covers all of its descendants.

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

## binValues

Counts raw values into histogram bins shaped for `BarChart`'s continuous
`x` / `x2` props (it is also exported from `@cfasim-ui/charts`). Bin `i`
spans `[x[i], x2[i])`; the last bin also holds the upper bound, and
non-finite values are skipped.

```ts
import { binValues } from "@cfasim-ui/shared";

binValues([0.2, 0.4, 1.1, 1.3, 1.9], { step: 0.5 });
// { x: [0, 0.5, 1, 1.5], x2: [0.5, 1, 1.5, 2], count: [2, 0, 2, 1] }
```

| Option       | Type                          | Default             |
| ------------ | ----------------------------- | ------------------- |
| `step`       | `number`                      | none                |
| `thresholds` | `number \| readonly number[]` | Sturges' rule count |
| `domain`     | `readonly [number, number]`   | the values' extent  |

`step` sets the bin width, with edges on its multiples, and wins over a
`thresholds` count. `thresholds` is a bin count, or explicit ascending
edges (values outside them are dropped). `domain` fixes the range for
equal-width or stepped bins. See the
[BarChart histogram demo](./charts/bar-chart#histograms-x2).

## d3Format / d3TimeFormat

Formatters from [d3-format](https://d3js.org/d3-format) and
[d3-time-format](https://d3js.org/d3-time-format) specifiers, the format
strings Vega-Lite, Altair and Observable use. Both return a function, so
they drop into any chart prop that takes a `NumberFormat` (`y-tick-format`,
`value-tick-format`, `tooltip-value-format`) or a `DateFormat`
(`x-tick-format` on a date axis). They are not re-exported from
`@cfasim-ui/charts`, so import them from `@cfasim-ui/shared`.

```ts
import { d3Format, d3TimeFormat } from "@cfasim-ui/shared";

d3Format(",.0f")(1234.5); // "1,235"
d3Format(".1%")(0.1234); // "12.3%"
d3Format("~s")(1500); // "1.5k"
d3Format("+.2f")(-1.5); // "−1.50"

d3TimeFormat("%b %d, %Y")(Date.UTC(2026, 0, 4)); // "Jan 04, 2026"
d3TimeFormat("%-m/%-d %H:%M", { timezone: "local" })(new Date());
```

Output matches d3's default en-US locale, including its typographic minus
sign (`−`, U+2212) for negative numbers. `d3Format` supports the full
`[[fill]align][sign][symbol][0][width][,][.precision][~][type]` grammar and
throws on a malformed specifier. `d3TimeFormat` supports every d3 directive
and the `-` / `_` / `0` padding modifiers, and formats in UTC unless
`timezone: "local"` is passed. UTC matches the charts' default date axis;
a chart does not pass its own `timezone` to the formatter, so on a
`timezone="local"` chart pass `{ timezone: "local" }` as well, or the
labels follow a different clock than the ticks.

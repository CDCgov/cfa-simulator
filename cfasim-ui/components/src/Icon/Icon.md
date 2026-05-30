# Icon

Renders a [Material Symbols](https://fonts.google.com/icons) icon as an inline
SVG. Icons are resolved from a registry by name, so you reference them exactly as
before — `<Icon icon="help" />` — but no webfont is loaded: only the SVGs you
actually use end up in your bundle.

A [base set](#base-set) of common icons is pre-registered and works with zero
setup. These SVGs are bundled inside `cfasim-ui`, so they need no extra install
or config — just `<Icon icon="help" />`. To use any other icon,
[register it](#registering-icons).

## Examples

### Sizes

<ComponentDemo>
  <Icon icon="help" size="sm" aria-label="help" />
  <Icon icon="help" size="md" aria-label="help" />
  <Icon icon="help" size="lg" aria-label="help" />

<template #code>

```vue
<Icon icon="help" size="sm" aria-label="help" />
<Icon icon="help" size="md" aria-label="help" />
<Icon icon="help" size="lg" aria-label="help" />
```

  </template>
</ComponentDemo>

### Filled

<ComponentDemo>
  <Icon icon="favorite" size="lg" aria-label="favorite" />
  <Icon icon="favorite" size="lg" :fill="true" aria-label="favorite filled" />

<template #code>

```vue
<Icon icon="favorite" size="lg" aria-label="favorite" />
<Icon icon="favorite" size="lg" :fill="true" aria-label="favorite filled" />
```

  </template>
</ComponentDemo>

### Inline in text

<ComponentDemo>
  <p style="margin: 0">Click the <Icon icon="help" size="sm" :inline="true" aria-label="help" /> icon for more info.</p>

<template #code>

```vue
<p>Click the <Icon icon="help" size="sm" :inline="true" aria-label="help" /> icon for more info.</p>
```

  </template>
</ComponentDemo>

## Base set

These icons are bundled with `cfasim-ui` and need no install or registration —
just pass the name to `icon`. Anything not listed here must be
[registered](#registering-icons).

<script setup>
const baseIcons = [
  "help", "favorite", "dark_mode", "light_mode",
  "chevron_left", "chevron_right", "keyboard_arrow_up", "keyboard_arrow_down",
  "keyboard_double_arrow_left", "keyboard_double_arrow_right",
  "arrow_upward", "arrow_downward", "arrow_back", "arrow_forward",
  "menu", "more_vert", "more_horiz",
  "add", "edit", "delete", "close", "check", "search", "tune", "download",
  "github",
];
</script>

<Grid class="base-icons" :cols="4" :colsSmall="2" gap="sm">
  <div v-for="name in baseIcons" :key="name" class="base-icons__cell">
    <Icon :icon="name" size="lg" :aria-label="name" />
    <code>{{ name }}</code>
  </div>
</Grid>

<style>
.base-icons__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  text-align: center;
}
.base-icons__cell code {
  font-size: 0.65rem;
  word-break: break-word;
}
</style>

`favorite` also has a filled variant via `:fill="true"`.

## Registering icons

The base set above is bundled with `cfasim-ui` and needs none of the steps below
— this section is only for additional icons. `cfasim-ui` does not depend on
`@material-symbols/svg-400`, so you install the icons yourself; each one you
import is inlined into _your_ bundle (still no webfont).

### 1. Install the icons and the Vite SVG loader

```sh
pnpm add -D @material-symbols/svg-400 vite-svg-loader
```

### 2. Add `svgLoader` to your Vite config

Add it to your existing `plugins` array — leave the other plugins in place:

```ts
// vite.config.ts
import svgLoader from "vite-svg-loader";

export default defineConfig({
  plugins: [
    // ...your existing plugins
    svgLoader(),
  ],
});
```

### 3. Register the icons once at startup

Import each SVG from the `outlined` style with the `?component` query, then pass
them to `registerIcons`. The key you register is the name you pass to `icon`.

```ts
// main.ts
import rocket from "@material-symbols/svg-400/outlined/rocket.svg?component";
import settings from "@material-symbols/svg-400/outlined/settings.svg?component";
import { registerIcons } from "@cfasim-ui/components";

registerIcons({ rocket, settings });
```

### 4. Use them by name

```vue
<Icon icon="rocket" />
<Icon icon="settings" size="lg" />
```

An unregistered name renders nothing and logs a one-time console warning with the
exact code to register it.

### Filled variants

To support `:fill="true"` on a registered icon, register both the outline and
`-fill` files:

```ts
import favorite from "@material-symbols/svg-400/outlined/favorite.svg?component";
import favoriteFill from "@material-symbols/svg-400/outlined/favorite-fill.svg?component";

registerIcons({ favorite: { outline: favorite, fill: favoriteFill } });
```

> The `weight` and `grade` props are deprecated no-ops — static SVGs ship at
> weight 400, grade 0. `size`, `fill`, `inline`, and color (`currentColor`) work
> as before.

<!--@include: ./_api/icon.md-->

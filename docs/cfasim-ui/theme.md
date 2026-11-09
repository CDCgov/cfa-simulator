# Theme

cfasim-ui uses CSS custom properties for all design tokens.

## Unified import (recommended)

The simplest way to load all cfasim-ui styles — design tokens, reset, utilities, and the CSS for every `@cfasim-ui/components` and `@cfasim-ui/charts` component — is a single import in your app entry:

```ts
// src/main.ts
import "@cfasim-ui/theme/all";
```

This pulls in `@cfasim-ui/theme`, `@cfasim-ui/components/style.css`, and `@cfasim-ui/charts/style.css` together. Use it whenever you're consuming the prebuilt packages from npm — without it, components and charts will render unstyled because their CSS is shipped as a separate file alongside their compiled JS.

Import the theme through your bundler rather than loading it with a `<link>` or from `public/`. A bundler can rewrite `light-dark()` in the component CSS for older browsers, and that only works when it processes the theme's `color-scheme` rules in the same build.

## Persisting the color scheme

`LightDarkToggle` (used in `SidebarLayout`'s topbar) saves a light or dark override to `localStorage` under the `color-scheme` key and applies it as a `light` or `dark` class on `<html>`. That code runs with the app's JavaScript, after the first paint, so on reload the page would show the system scheme and then switch. The theme package ships a Vite plugin that prepends a small inline script to `<head>` so the stored class is in place before the first paint:

```ts
// vite.config.ts
import { cfasimTheme } from "@cfasim-ui/theme/vite";

export default defineConfig({
  plugins: [vue(), cfasimTheme()],
});
```

Projects scaffolded by `cfasim init` include it. Without Vite, paste the script into your HTML's `<head>` before the stylesheets (a minified equivalent is exported as `colorSchemeScript` from `@cfasim-ui/theme/vite`):

```html
<script id="cfasim-color-scheme">
  (() => {
    try {
      var s = localStorage.getItem("color-scheme");
      if (s === "light" || s === "dark")
        document.documentElement.classList.add(s);
    } catch (e) {}
  })();
</script>
```

## Granular imports

If you want only the design tokens and base styles (no component or chart CSS), import the theme entry directly:

```ts
import "@cfasim-ui/theme";
```

Or cherry-pick individual layers:

```ts
import "@cfasim-ui/theme/base.css";
import "@cfasim-ui/theme/theme.css";
import "@cfasim-ui/theme/utilities.css";
```

## Variables

<<< ../../cfasim-ui/theme/src/theme.css

## Custom themes

To create a custom theme, add a CSS file that overrides variables under a `[data-theme="your-theme"]` selector. You only need to include the variables you want to change — everything else falls back to the defaults. Use `light-dark()` for any values that should differ between light and dark mode.

Here's the built-in `cdc` theme as an example:

<<< ../../cfasim-ui/theme/src/themes/cdc.css

To activate a theme, set the `data-theme` attribute on the root element:

```html
<html data-theme="your-theme"></html>
```

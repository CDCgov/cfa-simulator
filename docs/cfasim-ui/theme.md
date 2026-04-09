# Theme

cfasim-ui uses CSS custom properties for all design tokens.

## Unified import (recommended)

The simplest way to load all cfasim-ui styles — design tokens, reset, utilities, and the CSS for every `@cfasim-ui/components` and `@cfasim-ui/charts` component — is a single import in your app entry:

```ts
// src/main.ts
import "@cfasim-ui/theme/all";
```

This pulls in `@cfasim-ui/theme`, `@cfasim-ui/components/style.css`, and `@cfasim-ui/charts/style.css` together. Use it whenever you're consuming the prebuilt packages from npm — without it, components and charts will render unstyled because their CSS is shipped as a separate file alongside their compiled JS.

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

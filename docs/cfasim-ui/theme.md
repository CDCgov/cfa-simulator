# Theme

cfasim-ui uses CSS custom properties for all design tokens. Import `@cfasim-ui/theme` in your app to get the default theme.

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

import { COLOR_SCHEME_STORAGE_KEY } from "@cfasim-ui/shared/colorScheme";

/**
 * Inline script that applies the stored color scheme before first paint.
 * `theme.css` resolves `light-dark()` through `:root.light` / `:root.dark`,
 * so adding the class here is all the page needs; `LightDarkToggle` takes
 * over once the app mounts and keeps the same class and key current.
 *
 * Place it in `<head>` as a plain blocking script, before the stylesheets,
 * so a saved override never flashes the system scheme on reload.
 */
export const colorSchemeScript =
  `(()=>{try{var s=localStorage.getItem(${JSON.stringify(COLOR_SCHEME_STORAGE_KEY)});` +
  `if(s==="light"||s==="dark")document.documentElement.classList.add(s)}catch(e){}})()`;

/**
 * Vite plugin that prepends {@link colorSchemeScript} to the HTML entry's
 * `<head>` in dev and build.
 *
 * @returns {import("vite").Plugin}
 */
export function cfasimTheme() {
  return {
    name: "cfasim-theme",
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { id: "cfasim-color-scheme" },
          children: colorSchemeScript,
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

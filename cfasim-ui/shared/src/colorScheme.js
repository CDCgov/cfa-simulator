/**
 * localStorage key for the color scheme override: "light" or "dark", absent
 * for auto. Written by `LightDarkToggle` and read by the inline head script
 * that `@cfasim-ui/theme/vite` injects, so both must agree on it. Plain JS
 * because the Vite plugin loads it in Node without a TypeScript step.
 */
export const COLOR_SCHEME_STORAGE_KEY = "color-scheme";

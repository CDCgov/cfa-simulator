// The base icon set, registered on first use of <Icon> so `icon="..."` works
// with zero setup. These are the icons cfasim-ui itself uses, plus `favorite`
// for the docs fill demo. Each import inlines a ~0.3-0.6 KB SVG at build time.
//
// Registration is driven from Icon.vue's setup (a used code path) rather than a
// bare side-effect import, so it survives tree-shaking of this side-effect-free
// package.
import help from "@material-symbols/svg-400/outlined/help.svg?component";
import favorite from "@material-symbols/svg-400/outlined/favorite.svg?component";
import favoriteFill from "@material-symbols/svg-400/outlined/favorite-fill.svg?component";
import darkMode from "@material-symbols/svg-400/outlined/dark_mode.svg?component";
import lightMode from "@material-symbols/svg-400/outlined/light_mode.svg?component";
import keyboardDoubleArrowLeft from "@material-symbols/svg-400/outlined/keyboard_double_arrow_left.svg?component";
import keyboardDoubleArrowRight from "@material-symbols/svg-400/outlined/keyboard_double_arrow_right.svg?component";
import type { IconRegistration } from "./registry";
import { registerIcons, hasIcon } from "./registry";

const defaults: Record<string, IconRegistration> = {
  help,
  favorite: { outline: favorite, fill: favoriteFill },
  dark_mode: darkMode,
  light_mode: lightMode,
  keyboard_double_arrow_left: keyboardDoubleArrowLeft,
  keyboard_double_arrow_right: keyboardDoubleArrowRight,
};

let registered = false;

/**
 * Register the base icon set once. A name already registered by the consumer is
 * left untouched, so explicit `registerIcons` calls always win over defaults.
 */
export function registerDefaultIcons(): void {
  if (registered) return;
  registered = true;
  for (const [name, reg] of Object.entries(defaults)) {
    if (!hasIcon(name)) registerIcons({ [name]: reg });
  }
}

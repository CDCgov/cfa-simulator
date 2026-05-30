// The base icon set, registered on first use of <Icon> so `icon="..."` works
// with zero setup. These are bundled into the published package (each import
// inlines a ~0.3-0.6 KB SVG at build time), so consumers need no install.
//
// Registration is driven from Icon.vue's setup (a used code path) rather than a
// bare side-effect import, so it survives tree-shaking of this side-effect-free
// package.
//
// Keep this list and the "Base set" table in Icon.md in sync.
import help from "@material-symbols/svg-400/outlined/help.svg?component";
import favorite from "@material-symbols/svg-400/outlined/favorite.svg?component";
import favorite_fill from "@material-symbols/svg-400/outlined/favorite-fill.svg?component";
import dark_mode from "@material-symbols/svg-400/outlined/dark_mode.svg?component";
import light_mode from "@material-symbols/svg-400/outlined/light_mode.svg?component";
// chevrons / navigation
import chevron_left from "@material-symbols/svg-400/outlined/chevron_left.svg?component";
import chevron_right from "@material-symbols/svg-400/outlined/chevron_right.svg?component";
import keyboard_arrow_up from "@material-symbols/svg-400/outlined/keyboard_arrow_up.svg?component";
import keyboard_arrow_down from "@material-symbols/svg-400/outlined/keyboard_arrow_down.svg?component";
import keyboard_double_arrow_left from "@material-symbols/svg-400/outlined/keyboard_double_arrow_left.svg?component";
import keyboard_double_arrow_right from "@material-symbols/svg-400/outlined/keyboard_double_arrow_right.svg?component";
// arrows (all directions)
import arrow_upward from "@material-symbols/svg-400/outlined/arrow_upward.svg?component";
import arrow_downward from "@material-symbols/svg-400/outlined/arrow_downward.svg?component";
import arrow_back from "@material-symbols/svg-400/outlined/arrow_back.svg?component";
import arrow_forward from "@material-symbols/svg-400/outlined/arrow_forward.svg?component";
// menus
import menu from "@material-symbols/svg-400/outlined/menu.svg?component";
import more_vert from "@material-symbols/svg-400/outlined/more_vert.svg?component";
import more_horiz from "@material-symbols/svg-400/outlined/more_horiz.svg?component";
// actions
import add from "@material-symbols/svg-400/outlined/add.svg?component";
import edit from "@material-symbols/svg-400/outlined/edit.svg?component";
import deleteIcon from "@material-symbols/svg-400/outlined/delete.svg?component";
import close from "@material-symbols/svg-400/outlined/close.svg?component";
import check from "@material-symbols/svg-400/outlined/check.svg?component";
import search from "@material-symbols/svg-400/outlined/search.svg?component";
import tune from "@material-symbols/svg-400/outlined/tune.svg?component";
import download from "@material-symbols/svg-400/outlined/download.svg?component";
// brand logos (not part of Material Symbols)
import github from "./github.svg?component";
import type { IconRegistration } from "./registry";
import { registerIcons, hasIcon } from "./registry";

const defaults: Record<string, IconRegistration> = {
  // status / theme
  help,
  favorite: { outline: favorite, fill: favorite_fill },
  dark_mode,
  light_mode,
  // chevrons / navigation
  chevron_left,
  chevron_right,
  keyboard_arrow_up,
  keyboard_arrow_down,
  keyboard_double_arrow_left,
  keyboard_double_arrow_right,
  // arrows (all directions)
  arrow_upward,
  arrow_downward,
  arrow_back,
  arrow_forward,
  // menus
  menu,
  more_vert,
  more_horiz,
  // actions
  add,
  edit,
  delete: deleteIcon,
  close,
  check,
  search,
  tune,
  download,
  // brand logos
  github,
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

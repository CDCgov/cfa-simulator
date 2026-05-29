import type { Component } from "vue";

/** A registered icon. Provide a bare component (outline only) or both variants. */
export interface IconVariants {
  outline: Component;
  fill?: Component;
}

export type IconRegistration = Component | IconVariants;

const registry = new Map<string, IconVariants>();

function toVariants(reg: IconRegistration): IconVariants {
  return typeof reg === "object" && reg !== null && "outline" in reg
    ? (reg as IconVariants)
    : { outline: reg as Component };
}

/**
 * Register icons for use with `<Icon icon="name" />`. Call once at app startup.
 * Re-registering a name overwrites the previous entry.
 */
export function registerIcons(icons: Record<string, IconRegistration>): void {
  for (const [name, reg] of Object.entries(icons)) {
    registry.set(name, toVariants(reg));
  }
}

/** Resolve the component for an icon name, preferring the fill variant when asked. */
export function getIconComponent(
  name: string,
  fill = false,
): Component | undefined {
  const entry = registry.get(name);
  if (!entry) return undefined;
  return fill && entry.fill ? entry.fill : entry.outline;
}

/** Whether an icon name has been registered. */
export function hasIcon(name: string): boolean {
  return registry.has(name);
}

const warned = new Set<string>();

function importSnippet(name: string): string {
  const validIdent = /^[a-zA-Z_$][\w$]*$/.test(name);
  const ident = validIdent ? name : `icon_${name.replace(/[^\w$]/g, "_")}`;
  const reg = validIdent ? `{ ${name} }` : `{ "${name}": ${ident} }`;
  return (
    `  import ${ident} from "@material-symbols/svg-400/outlined/${name}.svg?component";\n` +
    `  import { registerIcons } from "@cfasim-ui/components";\n` +
    `  registerIcons(${reg});`
  );
}

/** Warn once per unregistered icon name with copy-pasteable registration code. */
export function warnMissingIcon(name: string): void {
  if (warned.has(name)) return;
  warned.add(name);
  console.warn(
    `[cfasim-ui] Icon "${name}" is not registered — nothing will render.\n` +
      `Register it once at startup:\n\n` +
      `${importSnippet(name)}\n\n` +
      `Requires dev deps "@material-symbols/svg-400" + "vite-svg-loader".\n` +
      `Docs: https://cdcgov.github.io/cfa-simulator/docs/cfasim-ui/components/icon#registering-icons`,
  );
}

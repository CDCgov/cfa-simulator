import { getCurrentInstance } from "vue";

interface LinkOption {
  href?: string;
  to?: string;
}

interface RouterLike {
  push(to: string): unknown;
  resolve(to: string): { href: string };
}

/**
 * `href` / `to` handling shared by List and Menu. vue-router is optional
 * (no hard dependency): `$router` on globalProperties is its public API,
 * as in SidebarLayout.
 */
export function useOptionLink() {
  const router = getCurrentInstance()?.appContext.config.globalProperties
    .$router as RouterLike | undefined;

  function linkHref(option: LinkOption) {
    if (option.href) return option.href;
    if (option.to) return router ? router.resolve(option.to).href : option.to;
    return undefined;
  }

  /** Routes a plain left click on a `to` link through the router. */
  function navigate(option: LinkOption, event: MouseEvent) {
    const plainClick =
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey;
    if (
      option.to &&
      !option.href &&
      router &&
      plainClick &&
      !event.defaultPrevented
    ) {
      event.preventDefault();
      router.push(option.to);
    }
  }

  return { linkHref, navigate };
}

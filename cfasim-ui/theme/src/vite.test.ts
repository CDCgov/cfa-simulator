import { describe, it, expect, beforeEach } from "vitest";
import { COLOR_SCHEME_STORAGE_KEY } from "@cfasim-ui/shared/colorScheme";
import { colorSchemeScript } from "./vite.js";

function runScript() {
  new Function(colorSchemeScript)();
}

describe("colorSchemeScript", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it.each(["light", "dark"])("applies a stored %s override", (scheme) => {
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme);
    runScript();
    expect(document.documentElement.className).toBe(scheme);
  });

  it("leaves the root alone for auto or junk values", () => {
    runScript();
    expect(document.documentElement.className).toBe("");
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, "sepia");
    runScript();
    expect(document.documentElement.className).toBe("");
  });
});

import { describe, it, expect } from "vitest";
import { fipsToHsa, hsaNames } from "./hsaMapping.js";

// County coverage (every projectable us-atlas county has an entry, every HSA
// code has member counties) is asserted in us-hsa-topology.test.ts, which
// already loads the atlas.
describe("fipsToHsa", () => {
  it("maps the five NYC boroughs to 360094", () => {
    for (const fips of ["36005", "36047", "36061", "36081", "36085"]) {
      expect(fipsToHsa[fips]).toBe("360094");
    }
  });

  // The table carries keys beyond current county ids: retired census areas and
  // upstream aggregate codes. They are harmless as long as they still resolve
  // to a named HSA in their own state, which is what the map places them by.
  it("every HSA code is 6-digit, state-prefixed, and named", () => {
    for (const [fips, code] of Object.entries(fipsToHsa)) {
      expect(code).toMatch(/^\d{6}$/);
      expect(code.slice(0, 2)).toBe(fips.slice(0, 2));
      expect(hsaNames[code]).toBeTruthy();
    }
  });
});

import { describe, it, expect } from "vitest";
import { usHsaTopology } from "./index.js";

describe("usHsaTopology", () => {
  it("contains merged hsas and states objects with valid 6-digit HSA ids", () => {
    const objects = usHsaTopology.objects as unknown as Record<
      string,
      { geometries: Array<{ id?: string | number }> }
    >;
    expect(Object.keys(objects).sort()).toEqual(["hsas", "states"]);
    expect(objects.hsas.geometries.length).toBeGreaterThan(900);
    expect(objects.states.geometries.length).toBeGreaterThanOrEqual(50);
    expect(String(objects.hsas.geometries[0].id)).toMatch(/^\d{6}$/);
  });
});

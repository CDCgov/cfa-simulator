import { describe, it, expect } from "vitest";
import {
  stateOfId,
  resolveGeoOverrides,
  serializeOverrides,
  parseOverrides,
  mixFeatures,
  type LevelLookup,
  type MixFeature,
} from "./mixedGeo.js";

const makeFeature = (id: string, name?: string): MixFeature => ({
  id,
  properties: name ? { name } : null,
});

const lookupOf = (features: MixFeature[]): LevelLookup => {
  const byId = new Map<string, MixFeature>();
  const byName = new Map<string, string>();
  for (const feat of features) {
    const id = String(feat.id);
    byId.set(id, feat);
    if (feat.properties?.name) byName.set(feat.properties.name, id);
  }
  return { byId, byName };
};

const STATES = lookupOf([
  makeFeature("06", "California"),
  makeFeature("36", "New York"),
]);
const COUNTIES = lookupOf([
  makeFeature("06037", "Los Angeles"),
  makeFeature("06075", "San Francisco"),
  makeFeature("36061", "New York"),
  makeFeature("36047", "Kings"),
]);
const HSAS = lookupOf([makeFeature("060723"), makeFeature("360011")]);
const HSA_TO_STATE = new Map([
  ["060723", "06"],
  ["360011", "36"],
]);

const resolver = (level: string) =>
  (
    ({ states: STATES, counties: COUNTIES, hsas: HSAS }) as Record<
      string,
      LevelLookup
    >
  )[level] ?? null;

describe("mixedGeo", () => {
  it("stateOfId extracts padded state FIPS for states, counties, and HSAs", () => {
    expect(stateOfId("states", "6")).toBe("06");
    expect(stateOfId("counties", "6037")).toBe("06");
    expect(stateOfId("hsas", "060723", HSA_TO_STATE)).toBe("06");
    expect(stateOfId("hsas", "060723")).toBeNull();
  });

  it("resolveGeoOverrides maps off-level rows by id or name and reports conflicts/unresolved", () => {
    const { overrides, unresolved, conflicts } = resolveGeoOverrides(
      [
        { id: "06037" },
        { id: "California", geoType: "states" },
        { id: "060723", geoType: "hsas" },
        { id: "Atlantis", geoType: "states" },
      ],
      "counties",
      resolver,
      HSA_TO_STATE,
    );
    expect([...overrides]).toEqual([["06", "states"]]);
    expect(conflicts).toEqual(["060723"]);
    expect(unresolved).toEqual(["Atlantis"]);
  });

  it("serializeOverrides and parseOverrides round-trip canonically", () => {
    const first = serializeOverrides(
      new Map([
        ["36", "counties"],
        ["06", "states"],
      ]),
    );
    const second = serializeOverrides(
      new Map([
        ["06", "states"],
        ["36", "counties"],
      ]),
    );
    expect(first).toBe(second);
    expect([...parseOverrides(first)]).toEqual([
      ["06", "states"],
      ["36", "counties"],
    ]);
    expect(parseOverrides("").size).toBe(0);
  });

  it("mixFeatures merges, splits, substitutes HSAs, and guards missing levels", () => {
    const counties = [...COUNTIES.byId.values()];
    const states = [...STATES.byId.values()];

    expect(
      mixFeatures(counties, "counties", new Map(), resolver).features,
    ).toBe(counties);

    const merged = mixFeatures(
      counties,
      "counties",
      new Map([["06", "states"]]),
      resolver,
    );
    expect(merged.features.map((feat) => String(feat.id))).toEqual(
      expect.arrayContaining(["06", "36061", "36047"]),
    );
    expect(merged.levelById.get("06")).toBe("states");

    const split = mixFeatures(
      states,
      "states",
      new Map([["36", "counties"]]),
      resolver,
    );
    expect(split.features.map((feat) => String(feat.id))).toEqual(
      expect.arrayContaining(["06", "36061", "36047"]),
    );

    const withHsa = mixFeatures(
      counties,
      "counties",
      new Map([["06", "hsas"]]),
      resolver,
      HSA_TO_STATE,
    );
    expect(withHsa.features.map((feat) => String(feat.id))).toContain("060723");
    expect(withHsa.features.map((feat) => String(feat.id))).not.toContain(
      "06037",
    );

    // Without HSA_TO_STATE, counties stay intact instead of leaving a hole.
    const unready = mixFeatures(
      counties,
      "counties",
      new Map([["06", "hsas"]]),
      resolver,
      null,
    );
    expect(unready.features).toBe(counties);
  });
});

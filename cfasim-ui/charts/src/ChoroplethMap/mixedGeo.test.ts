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

const f = (id: string, name?: string): MixFeature => ({
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

const STATES = lookupOf([f("06", "California"), f("36", "New York")]);
const COUNTIES = lookupOf([
  f("06037", "Los Angeles"),
  f("06075", "San Francisco"),
  f("36061", "New York"),
  f("36047", "Kings"),
]);
const HSAS = lookupOf([f("060723"), f("360011")]);
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

describe("stateOfId", () => {
  it("reads the FIPS prefix for states and counties", () => {
    expect(stateOfId("states", "06")).toBe("06");
    expect(stateOfId("counties", "06037")).toBe("06");
  });

  it("zero-pads short ids to their level's width", () => {
    expect(stateOfId("states", "6")).toBe("06");
    expect(stateOfId("counties", "6037")).toBe("06");
  });

  it("places an HSA through the inverted FIPS→HSA table", () => {
    expect(stateOfId("hsas", "060723", HSA_TO_STATE)).toBe("06");
    // HSA codes aren't state-prefixed, so there's no fallback without it.
    expect(stateOfId("hsas", "060723")).toBeNull();
  });
});

describe("resolveGeoOverrides", () => {
  it("ignores rows at the base level", () => {
    const { overrides } = resolveGeoOverrides(
      [{ id: "06037" }, { id: "36061", geoType: "counties" }],
      "counties",
      resolver,
    );
    expect(overrides.size).toBe(0);
  });

  it("maps an off-level row to its state", () => {
    const { overrides } = resolveGeoOverrides(
      [{ id: "06037" }, { id: "36", geoType: "states" }],
      "counties",
      resolver,
    );
    expect([...overrides]).toEqual([["36", "states"]]);
  });

  it("resolves a row keyed by feature name", () => {
    const { overrides } = resolveGeoOverrides(
      [{ id: "California", geoType: "states" }],
      "counties",
      resolver,
    );
    expect(overrides.get("06")).toBe("states");
  });

  it("splits a state map by a single county row", () => {
    const { overrides } = resolveGeoOverrides(
      [{ id: "36061", geoType: "counties" }],
      "states",
      resolver,
    );
    expect(overrides.get("36")).toBe("counties");
  });

  it("reports rows whose id resolves to no state", () => {
    const { overrides, unresolved } = resolveGeoOverrides(
      [{ id: "Atlantis", geoType: "states" }],
      "counties",
      resolver,
    );
    expect(overrides.size).toBe(0);
    expect(unresolved).toEqual(["Atlantis"]);
  });

  it("reports a level the topology can't supply", () => {
    const { unresolved } = resolveGeoOverrides(
      [{ id: "060723", geoType: "hsas" }],
      "counties",
      () => null,
    );
    expect(unresolved).toEqual(["060723"]);
  });

  it("keeps the first level when two rows claim one state differently", () => {
    const { overrides, conflicts } = resolveGeoOverrides(
      [
        { id: "06", geoType: "states" },
        { id: "060723", geoType: "hsas" },
      ],
      "counties",
      resolver,
      HSA_TO_STATE,
    );
    expect(overrides.get("06")).toBe("states");
    expect(conflicts).toEqual(["060723"]);
  });

  it("takes many rows for the same state as one override", () => {
    const { overrides, conflicts } = resolveGeoOverrides(
      [
        { id: "36061", geoType: "counties" },
        { id: "36047", geoType: "counties" },
      ],
      "states",
      resolver,
    );
    expect([...overrides]).toEqual([["36", "counties"]]);
    expect(conflicts).toEqual([]);
  });
});

describe("serializeOverrides / parseOverrides", () => {
  it("round-trips, ordered so equal sets compare equal", () => {
    const a = serializeOverrides(
      new Map([
        ["36", "counties"],
        ["06", "states"],
      ]),
    );
    const b = serializeOverrides(
      new Map([
        ["06", "states"],
        ["36", "counties"],
      ]),
    );
    expect(a).toBe(b);
    expect([...parseOverrides(a)]).toEqual([
      ["06", "states"],
      ["36", "counties"],
    ]);
  });

  it("parses an empty key to an empty map", () => {
    expect(parseOverrides("").size).toBe(0);
  });
});

describe("mixFeatures", () => {
  const counties = [...COUNTIES.byId.values()];
  const states = [...STATES.byId.values()];

  it("returns the base array untouched when nothing is overridden", () => {
    const result = mixFeatures(counties, "counties", new Map(), resolver);
    expect(result.features).toBe(counties);
    expect(result.levelById.size).toBe(0);
  });

  it("merges an overridden state's counties into the state feature", () => {
    const { features, levelById } = mixFeatures(
      counties,
      "counties",
      new Map([["06", "states"]]),
      resolver,
    );
    const ids = features.map((x) => String(x.id));
    expect(ids).not.toContain("06037");
    expect(ids).not.toContain("06075");
    expect(ids).toContain("06");
    // Other states keep their counties.
    expect(ids).toContain("36061");
    expect(levelById.get("06")).toBe("states");
    expect(levelById.has("36061")).toBe(false);
  });

  it("splits an overridden state on a state base map", () => {
    const { features, levelById } = mixFeatures(
      states,
      "states",
      new Map([["36", "counties"]]),
      resolver,
    );
    const ids = features.map((x) => String(x.id));
    expect(ids).toContain("06");
    expect(ids).not.toContain("36");
    expect(ids).toEqual(expect.arrayContaining(["36061", "36047"]));
    expect(levelById.get("36061")).toBe("counties");
  });

  it("substitutes HSAs for one state", () => {
    const { features } = mixFeatures(
      counties,
      "counties",
      new Map([["06", "hsas"]]),
      resolver,
      HSA_TO_STATE,
    );
    const ids = features.map((x) => String(x.id));
    expect(ids).toContain("060723");
    expect(ids).not.toContain("06037");
    expect(ids).not.toContain("360011");
  });

  it("drops substitutions outside a single-state scope", () => {
    const { features } = mixFeatures(
      counties.filter((x) => String(x.id).startsWith("36")),
      "counties",
      new Map([["06", "states"]]),
      resolver,
      null,
      "36",
    );
    expect(features.map((x) => String(x.id))).toEqual(["36061", "36047"]);
  });

  it("leaves the base intact when the override level isn't ready yet", () => {
    // No HSA→state table yet (lazy chunk still loading) — nothing can stand in
    // for California, so its counties must stay rather than leave a hole.
    const { features, levelById } = mixFeatures(
      counties,
      "counties",
      new Map([["06", "hsas"]]),
      resolver,
      null,
    );
    expect(features).toBe(counties);
    expect(levelById.size).toBe(0);
  });

  it("only cuts out the states it can actually replace", () => {
    const { features } = mixFeatures(
      counties,
      "counties",
      new Map([
        ["06", "states"],
        ["36", "hsas"],
      ]),
      resolver,
      // California resolves; New York's HSAs can't be placed without the table.
      null,
    );
    const ids = features.map((x) => String(x.id));
    expect(ids).toContain("06");
    expect(ids).toEqual(expect.arrayContaining(["36061", "36047"]));
  });
});

import { describe, it, expect } from "vitest";
import { feature, merge } from "topojson-client";
import type { Topology } from "topojson-specification";
import usCounties from "us-atlas/counties-10m.json";
import { fipsToHsa, hsaNames } from "../ChoroplethMap/hsaMapping.js";
import { usHsaTopology } from "./index.js";

// These tests pin the committed artifact (data.ts) to the runtime merge
// semantics ChoroplethMap uses when given a counties topology. If they fail
// after a us-atlas or fipsToHsa change, regenerate:
//   node scripts/generate-us-hsa-topology.mjs

const countiesTopo = usCounties as unknown as Topology;

type GeomCollection = {
  type: string;
  geometries: Array<{ id?: string | number }>;
};

function objects(topo: Topology) {
  return topo.objects as unknown as Record<string, GeomCollection>;
}

// Distinct HSA codes with at least one us-atlas county — the set the runtime
// merge produces.
function mappableHsaCodes(): Set<string> {
  const codes = new Set<string>();
  for (const g of objects(countiesTopo).counties.geometries) {
    const code = fipsToHsa[String(g.id).padStart(5, "0")];
    if (code) codes.add(code);
  }
  return codes;
}

describe("usHsaTopology", () => {
  it("contains merged HSAs plus the unchanged states object, nothing else", () => {
    const objs = objects(usHsaTopology);
    expect(Object.keys(objs).sort()).toEqual(["hsas", "states"]);
    expect(objs.hsas.geometries).toHaveLength(mappableHsaCodes().size);
    expect(objs.states.geometries).toHaveLength(
      objects(countiesTopo).states.geometries.length,
    );
  });

  it("ids are 6-char state-prefixed HSA codes with hsaNames entries", () => {
    const stateFips = new Set(
      objects(countiesTopo).states.geometries.map((g) =>
        String(g.id).padStart(2, "0"),
      ),
    );
    for (const g of objects(usHsaTopology).hsas.geometries) {
      const id = String(g.id);
      expect(id).toMatch(/^\d{6}$/);
      expect(stateFips.has(id.slice(0, 2))).toBe(true);
      expect(hsaNames[id]).toBeTruthy();
    }
  });

  it("every HSA geometry exactly equals the legacy runtime county merge", () => {
    const groups = new Map<string, object[]>();
    for (const g of objects(countiesTopo).counties.geometries) {
      const code = fipsToHsa[String(g.id).padStart(5, "0")];
      if (!code) continue;
      if (!groups.has(code)) groups.set(code, []);
      groups.get(code)!.push(g);
    }

    const fc = feature(
      usHsaTopology,
      usHsaTopology.objects.hsas,
    ) as GeoJSON.FeatureCollection;
    expect(fc.features).toHaveLength(groups.size);

    let compared = 0;
    for (const f of fc.features) {
      const legacy = merge(
        countiesTopo,
        groups.get(String(f.id)) as Parameters<typeof merge>[1],
      );
      // Stringified compare: cheap for 948 coordinate trees, and exact — the
      // artifact reuses the us-atlas quantization grid, so the round-trip
      // through the generator is lossless.
      expect(JSON.stringify(f.geometry)).toBe(JSON.stringify(legacy));
      compared++;
    }
    expect(compared).toBe(groups.size);
  });

  it("state features decode identically to the us-atlas states", () => {
    const artifactStates = feature(
      usHsaTopology,
      usHsaTopology.objects.states,
    ) as GeoJSON.FeatureCollection;
    const atlasStates = feature(
      countiesTopo,
      countiesTopo.objects.states,
    ) as GeoJSON.FeatureCollection;
    expect(JSON.stringify(artifactStates)).toBe(JSON.stringify(atlasStates));
  });
});

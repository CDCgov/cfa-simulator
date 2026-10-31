import { describe, it, expect } from "vitest";
import { geoContains } from "d3-geo";
import { merge } from "topojson-client";
import type {
  GeometryCollection,
  Polygon,
  MultiPolygon,
  Topology,
} from "topojson-specification";
import {
  meshCounties,
  countyBordersPredicate,
  hsaBordersPredicate,
} from "./bordersMesh.js";
import { countiesTopo, statesTopo } from "./ChoroplethMap.testUtils.js";
import { fipsToHsa } from "./hsaMapping.js";

// Six unit-square counties in a row, two per state: 01001 01002 | 02001
// 02003 | 03001 03003. Arcs 0..6 are the vertical edges at x = 0..6, then
// the bottom and top edges, so every interior county border is a vertical
// line and a mesh reads as the sorted x positions of its lines.
const ids = ["01001", "01002", "02001", "02003", "03001", "03003"];
const strip: Topology = {
  type: "Topology",
  arcs: [
    ...ids.map((_, k) => [
      [k, 0],
      [k, 1],
    ]),
    [
      [6, 0],
      [6, 1],
    ],
    ...ids.map((_, k) => [
      [k, 0],
      [k + 1, 0],
    ]),
    ...ids.map((_, k) => [
      [k, 1],
      [k + 1, 1],
    ]),
  ],
  objects: {
    counties: {
      type: "GeometryCollection",
      geometries: ids.map((id, k) => ({
        type: "Polygon",
        id,
        arcs: [[7 + k, k + 1, ~(13 + k), ~k]],
      })),
    } as GeometryCollection,
  },
};
const sameState = (a: unknown, b: unknown) =>
  String(a).slice(0, 2) === String(b).slice(0, 2);
const linesAt = (m: GeoJSON.MultiLineString | null) =>
  m!.coordinates.map((line) => line[0][0]).sort();

describe("meshCounties", () => {
  it("returns null without a counties object", () => {
    expect(meshCounties(undefined, sameState)).toBeNull();
    expect(meshCounties(statesTopo, sameState)).toBeNull();
  });

  it("meshes the shared arcs the predicate keeps, never exteriors", () => {
    expect(linesAt(meshCounties(strip, sameState))).toEqual([1, 3, 5]);
    expect(linesAt(meshCounties(strip, () => true))).toEqual([1, 2, 3, 4, 5]);
  });

  it("scopes to one state", () => {
    expect(linesAt(meshCounties(strip, sameState, { scope: "02" }))).toEqual([
      3,
    ]);
  });

  it("drops states re-tiled through data[].geoType", () => {
    const overridden = new Set(["02"]);
    expect(linesAt(meshCounties(strip, sameState, { overridden }))).toEqual([
      1, 5,
    ]);
    expect(linesAt(meshCounties(strip, () => true, { overridden }))).toEqual([
      1, 5,
    ]);
  });

  it("leaves no HSA separator inside a re-tiled state on the US topology", () => {
    const predicate = hsaBordersPredicate(fipsToHsa);
    const counties = (countiesTopo.objects as { counties: GeometryCollection })
      .counties;
    const california = merge(
      countiesTopo,
      counties.geometries.filter((g) => String(g.id).startsWith("06")) as (
        Polygon | MultiPolygon
      )[],
    );
    // No arc of either mesh runs along a state line, so a segment midpoint
    // is strictly inside one state.
    const midpoints = (m: GeoJSON.MultiLineString | null) =>
      m!.coordinates.map(([a, b]) => [
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
      ]) as [number, number][];
    const inCalifornia = (p: [number, number]) => geoContains(california, p);
    const full = midpoints(meshCounties(countiesTopo, predicate));
    const unruled = midpoints(
      meshCounties(countiesTopo, predicate, { overridden: new Set(["06"]) }),
    );
    expect(full.some(inCalifornia)).toBe(true);
    expect(unruled.some(inCalifornia)).toBe(false);
    expect(unruled.length).toBeLessThan(full.length);
  });
});

describe("countyBordersPredicate", () => {
  const groupOf = (id: unknown) =>
    ({ "01001": "A", "01002": "A", "02001": "B" })[String(id)];
  const keep = countyBordersPredicate(groupOf);

  it("keeps arcs interior to a group and drops group boundaries", () => {
    expect(keep("01001", "01002")).toBe(true);
    expect(keep("01002", "02001")).toBe(false);
  });

  it("leaves an unmapped county unruled", () => {
    expect(keep("02003", "03001")).toBe(false);
  });
});

describe("hsaBordersPredicate", () => {
  const keep = hsaBordersPredicate({
    "01001": "A",
    "01002": "B",
    "02001": "C",
    "02003": "C",
    "03001": "D",
  });

  it("keeps HSA boundaries inside a state and drops same-HSA arcs", () => {
    expect(keep("01001", "01002")).toBe(true);
    expect(keep("02001", "02003")).toBe(false);
  });

  it("drops state-crossing arcs", () => {
    expect(keep("01002", "02001")).toBe(false);
  });

  it("draws a mapped-to-unmapped edge as an HSA exterior", () => {
    expect(keep("03001", "03003")).toBe(true);
  });

  it("pads numeric ids", () => {
    expect(keep(1001, 1002)).toBe(true);
  });
});

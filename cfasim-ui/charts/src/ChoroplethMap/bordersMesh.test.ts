import { describe, it, expect } from "vitest";
import type { GeometryCollection, Topology } from "topojson-specification";
import {
  meshCounties,
  countyBordersPredicate,
  hsaBordersPredicate,
} from "./bordersMesh.js";
import { statesTopo } from "./ChoroplethMap.testUtils.js";

// Six unit-square counties in a row, two per state: 01001 01002 | 02001
// 02003 | 03001 03003. Interior county borders are vertical lines at x = 1..5.
const countyIds = ["01001", "01002", "02001", "02003", "03001", "03003"];
const strip: Topology = {
  type: "Topology",
  arcs: [
    ...countyIds.map((_, idx) => [
      [idx, 0],
      [idx, 1],
    ]),
    [
      [6, 0],
      [6, 1],
    ],
    ...countyIds.map((_, idx) => [
      [idx, 0],
      [idx + 1, 0],
    ]),
    ...countyIds.map((_, idx) => [
      [idx, 1],
      [idx + 1, 1],
    ]),
  ],
  objects: {
    counties: {
      type: "GeometryCollection",
      geometries: countyIds.map((id, idx) => ({
        type: "Polygon",
        id,
        arcs: [[7 + idx, idx + 1, ~(13 + idx), ~idx]],
      })),
    } as GeometryCollection,
  },
};

const sameState = (a: unknown, b: unknown) =>
  String(a).slice(0, 2) === String(b).slice(0, 2);
const linesAt = (mesh: GeoJSON.MultiLineString | null) =>
  mesh!.coordinates.map((line) => line[0][0]).sort();

describe("meshCounties", () => {
  it("returns null without a counties object", () => {
    expect(meshCounties(undefined, sameState)).toBeNull();
    expect(meshCounties(statesTopo, sameState)).toBeNull();
  });

  it("meshes shared arcs matching the predicate, scoping and dropping overrides", () => {
    expect(linesAt(meshCounties(strip, sameState))).toEqual([1, 3, 5]);
    expect(linesAt(meshCounties(strip, () => true))).toEqual([1, 2, 3, 4, 5]);
    expect(linesAt(meshCounties(strip, sameState, { scope: "02" }))).toEqual([
      3,
    ]);
    const overridden = new Set(["02"]);
    expect(linesAt(meshCounties(strip, sameState, { overridden }))).toEqual([
      1, 5,
    ]);
  });
});

describe("border predicates", () => {
  it("countyBordersPredicate keeps interior group arcs and drops boundaries/unmapped", () => {
    const groupOf = (id: unknown) =>
      ({ "01001": "A", "01002": "A", "02001": "B" })[String(id)];
    const keep = countyBordersPredicate(groupOf);
    expect(keep("01001", "01002")).toBe(true);
    expect(keep("01002", "02001")).toBe(false);
    expect(keep("02003", "03001")).toBe(false);
  });

  it("hsaBordersPredicate keeps in-state HSA boundaries and mapped-to-unmapped edges", () => {
    const keep = hsaBordersPredicate({
      "01001": "A",
      "01002": "B",
      "02001": "C",
      "02003": "C",
      "03001": "D",
    });
    expect(keep("01001", "01002")).toBe(true);
    expect(keep(1001, 1002)).toBe(true);
    expect(keep("02001", "02003")).toBe(false);
    expect(keep("01002", "02001")).toBe(false);
    expect(keep("03001", "03003")).toBe(true);
  });
});

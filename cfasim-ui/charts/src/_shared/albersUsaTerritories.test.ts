import { describe, it, expect } from "vitest";
import {
  geoAlbersUsa as d3AlbersUsa,
  geoPath,
  type GeoPermissibleObjects,
} from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import usStates from "us-atlas/states-10m.json";
import {
  geoAlbersUsa,
  geoAlbersUsaTerritories,
} from "./albersUsaTerritories.js";

const topo = usStates as unknown as Topology<{ states: GeometryCollection }>;
const states = feature(topo, topo.objects.states);
const TERRITORIES = ["60", "66", "69", "72", "78"];
const byId = (id: string) => states.features.find((feat) => feat.id === id)!;
const collection = (ids: string[]) =>
  ({
    type: "FeatureCollection",
    features: states.features.filter((feat) => ids.includes(String(feat.id))),
  }) as GeoPermissibleObjects;

type Bounds = [[number, number], [number, number]];
const overlaps = (a: Bounds, b: Bounds) =>
  a[0][0] < b[1][0] &&
  b[0][0] < a[1][0] &&
  a[0][1] < b[1][1] &&
  b[0][1] < a[1][1];

describe("geoAlbersUsaTerritories", () => {
  const projection = geoAlbersUsaTerritories().scale(1000).translate([0, 0]);
  const path = geoPath(projection);

  it("places every state, DC, and territory with non-overlapping territory insets", () => {
    for (const feat of states.features) {
      const [x, y] = path.centroid(feat);
      expect(Number.isFinite(x) && Number.isFinite(y), String(feat.id)).toBe(
        true,
      );
    }

    const stateBounds = states.features
      .filter((feat) => !TERRITORIES.includes(String(feat.id)))
      .map((feat) => [String(feat.id), path.bounds(feat) as Bounds] as const);
    const insets = TERRITORIES.map((id) => path.bounds(byId(id)) as Bounds);
    insets.forEach((box, idx) => {
      for (const [id, stateBox] of stateBounds) {
        expect(overlaps(box, stateBox), `${TERRITORIES[idx]} over ${id}`).toBe(
          false,
        );
      }
    });
    for (let i = 0; i < insets.length; i++) {
      for (let j = i + 1; j < insets.length; j++) {
        expect(overlaps(insets[i], insets[j])).toBe(false);
      }
    }
  });

  it("projects and inverts both territories and mainland points accurately", () => {
    const prPoint = projection([-66.1, 18.4])!;
    const [[x0, y0], [x1, y1]] = path.bounds(byId("72"));
    expect(prPoint[0]).toBeGreaterThan(x0);
    expect(prPoint[0]).toBeLessThan(x1);
    expect(prPoint[1]).toBeGreaterThan(y0);
    expect(prPoint[1]).toBeLessThan(y1);
    expect(projection.invert!(prPoint)![0]).toBeCloseTo(-66.1, 6);

    const palmBeach: [number, number] = [-80.1, 26.7];
    const [lon, lat] = projection.invert!(projection(palmBeach)!)!;
    expect(lon).toBeCloseTo(palmBeach[0], 6);
    expect(lat).toBeCloseTo(palmBeach[1], 6);
  });

  it("fits inset frames on national maps and centers a lone territory", () => {
    const extent: Bounds = [
      [0, 0],
      [960, 600],
    ];
    const allIds = states.features.map((feat) => String(feat.id));
    const allBounds = geoPath(
      geoAlbersUsaTerritories().fitExtent(extent, collection(allIds)),
    ).bounds(collection(allIds));
    expect(allBounds[0][0]).toBeGreaterThan(5);
    expect(allBounds[1][0]).toBeLessThanOrEqual(960);

    const pr = collection(["72"]);
    const prBounds = geoPath(
      geoAlbersUsaTerritories().fitExtent(
        [
          [0, 0],
          [600, 400],
        ],
        pr,
      ),
    ).bounds(pr);
    expect(prBounds[0][0]).toBeCloseTo(0, 6);
    expect(prBounds[1][0]).toBeCloseTo(600, 6);
  });

  it("geoAlbersUsa matches d3AlbersUsa on states fit, paths, and point projection", () => {
    const extent: Bounds = [
      [0, 0],
      [960, 600],
    ];
    const ours = geoAlbersUsa().fitExtent(extent, states);
    const d3s = d3AlbersUsa().fitExtent(extent, states);
    expect(ours.scale()).toBe(d3s.scale());
    expect(ours.translate()).toEqual(d3s.translate());

    const routed = geoPath(ours);
    const expected = geoPath(d3s);
    for (const feat of states.features) {
      expect(routed(feat), String(feat.id)).toBe(expected(feat));
    }

    for (const point of [
      [-96, 38.7],
      [-150, 62],
      [-157.8, 21.3],
    ] as [number, number][]) {
      expect(ours(point)).toEqual(d3s(point));
    }
  });
});

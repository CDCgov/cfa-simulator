import { describe, it, expect } from "vitest";
import { geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import usStates from "us-atlas/states-10m.json";
import { geoAlbersUsaTerritories } from "./albersUsaTerritories.js";

const topo = usStates as unknown as Topology<{ states: GeometryCollection }>;
const states = feature(topo, topo.objects.states);
const TERRITORIES = ["60", "66", "69", "72", "78"];
const byId = (id: string) => states.features.find((f) => f.id === id)!;
const collection = (ids: string[]) =>
  ({
    type: "FeatureCollection",
    features: states.features.filter((f) => ids.includes(String(f.id))),
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

  it("places every state, DC and territory", () => {
    for (const f of states.features) {
      const [x, y] = path.centroid(f);
      expect(Number.isFinite(x) && Number.isFinite(y), String(f.id)).toBe(true);
    }
  });

  it("keeps the territory insets clear of the states and of each other", () => {
    const stateBounds = states.features
      .filter((f) => !TERRITORIES.includes(String(f.id)))
      .map((f) => [String(f.id), path.bounds(f) as Bounds] as const);
    const insets = TERRITORIES.map((id) => path.bounds(byId(id)) as Bounds);
    insets.forEach((b, i) => {
      for (const [id, sb] of stateBounds)
        expect(overlaps(b, sb), `${TERRITORIES[i]} over ${id}`).toBe(false);
    });
    for (let i = 0; i < insets.length; i++)
      for (let j = i + 1; j < insets.length; j++)
        expect(overlaps(insets[i], insets[j])).toBe(false);
  });

  it("draws each territory once, at the point the projection reports", () => {
    const pr = byId("72");
    const [x, y] = projection([-66.1, 18.4])!;
    const [[x0, y0], [x1, y1]] = path.bounds(pr);
    expect(x).toBeGreaterThan(x0);
    expect(x).toBeLessThan(x1);
    expect(y).toBeGreaterThan(y0);
    expect(y).toBeLessThan(y1);
    expect(projection.invert!([x, y])![0]).toBeCloseTo(-66.1, 6);
  });

  it("fits the inset frames, so callout labels have room", () => {
    const extent: Bounds = [
      [0, 0],
      [960, 600],
    ];
    const all = geoAlbersUsaTerritories().fitExtent(
      extent,
      collection(states.features.map((f) => String(f.id))),
    );
    const [[x0], [x1]] = geoPath(all).bounds(
      collection(states.features.map((f) => String(f.id))),
    );
    // Guam's inset frame, not the island, sits at the left edge.
    expect(x0).toBeGreaterThan(5);
    expect(x1).toBeLessThanOrEqual(960);

    // Without territories there is no frame to fit: same as Albers USA.
    const statesOnly = collection(
      states.features
        .map((f) => String(f.id))
        .filter((id) => !TERRITORIES.includes(id)),
    );
    const plain = geoPath(
      geoAlbersUsaTerritories().fitExtent(extent, statesOnly),
    ).bounds(statesOnly);
    expect(plain[0][0]).toBeCloseTo(0, 6);
  });

  it("inverts mainland points next to an inset to the mainland", () => {
    const palmBeach: [number, number] = [-80.1, 26.7];
    const [lon, lat] = projection.invert!(projection(palmBeach)!)!;
    expect(lon).toBeCloseTo(palmBeach[0], 6);
    expect(lat).toBeCloseTo(palmBeach[1], 6);
  });

  it("centers a lone territory without the label frame", () => {
    const pr = collection(["72"]);
    const [[x0], [x1]] = geoPath(
      geoAlbersUsaTerritories().fitExtent(
        [
          [0, 0],
          [600, 400],
        ],
        pr,
      ),
    ).bounds(pr);
    expect(x0).toBeCloseTo(0, 6);
    expect(x1).toBeCloseTo(600, 6);
  });

  it("supports fitWidth and fitHeight", () => {
    const all = collection(states.features.map((f) => String(f.id)));
    const w = geoPath(geoAlbersUsaTerritories().fitWidth(800, all)).bounds(all);
    expect(w[1][0]).toBeLessThanOrEqual(800 + 1e-6);
    expect(w[0][1]).toBeGreaterThanOrEqual(-1e-6);
    const h = geoPath(geoAlbersUsaTerritories().fitHeight(500, all)).bounds(
      all,
    );
    expect(h[1][1]).toBeLessThanOrEqual(500 + 1e-6);
    expect(h[0][0]).toBeGreaterThanOrEqual(-1e-6);
  });
});

import { describe, it, expect } from "vitest";
import {
  geoAlbersUsa as d3AlbersUsa,
  geoPath,
  type GeoPermissibleObjects,
} from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import usStates from "us-atlas/states-10m.json";
import usCounties from "us-atlas/counties-10m.json";
import {
  geoAlbersUsa,
  geoAlbersUsaTerritories,
  REGIONS,
  placeRegion,
} from "./albersUsaTerritories.js";

const topo = usStates as unknown as Topology<{ states: GeometryCollection }>;
const states = feature(topo, topo.objects.states);
const countiesTopo = usCounties as unknown as Topology<{
  counties: GeometryCollection;
}>;
const counties = feature(countiesTopo, countiesTopo.objects.counties);
const TERRITORIES = ["60", "66", "69", "72", "78"];
const isTerritory = (f: { id?: string | number }) =>
  TERRITORIES.includes(String(f.id).slice(0, 2));
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

  // The stream routes each ring to one sub-projection instead of multiplexing
  // it through all nine. The mainland must come out exactly as d3's own
  // composite draws it, and each territory exactly as its inset projection
  // alone would, for every state and county. `k`/`t` are the 960×600 fit of
  // the states atlas, pinned below.
  describe("draws what the multiplexed sub-projections drew", () => {
    const k = 1015.8730158730158;
    const t: [number, number] = [487.6190476190476, 292.1971116355054];
    const routed = geoPath(geoAlbersUsaTerritories().scale(k).translate(t));
    const mainland = geoPath(d3AlbersUsa().scale(k).translate(t));
    const insets = REGIONS.filter((r) => r.kind === "territory").map((spec) => {
      const p = spec.projection();
      placeRegion(p, spec, k, t);
      return geoPath(p);
    });
    // American Samoa spans two insets, so compare polygon by polygon: each
    // must be drawn by exactly one inset, or by none.
    const polygons = (f: GeoJSON.Feature): GeoJSON.Feature[] => {
      const g = f.geometry;
      const coords =
        g.type === "Polygon"
          ? [g.coordinates]
          : g.type === "MultiPolygon"
            ? g.coordinates
            : [];
      return coords.map((c) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: c },
      }));
    };
    const checkTerritory = (f: GeoJSON.Feature) => {
      for (const poly of polygons(f)) {
        const drawn = insets.map((p) => p(poly)).filter((d) => d);
        expect(drawn.length, String(f.id)).toBeLessThanOrEqual(1);
        expect(routed(poly), String(f.id)).toBe(drawn[0] ?? null);
      }
    };

    for (const [name, fc] of [
      ["states", states],
      ["counties", counties],
    ] as const) {
      it(name, () => {
        expect(fc.features.length).toBeGreaterThan(50);
        for (const f of fc.features) {
          if (isTerritory(f)) checkTerritory(f);
          else expect(routed(f), String(f.id)).toBe(mainland(f));
        }
      });
    }

    // The atlas never straddles regions, so the multiplex fallback needs
    // synthetic geometry: a line between two regions, a polygon spanning
    // two, a ring that starts outside its owner's clip, and one whose
    // vertices all sit outside every clip but whose edges cross one.
    const polygon = (ring: [number, number][]): GeoJSON.Feature => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [ring] },
    });
    const line = (coords: [number, number][]): GeoJSON.Feature => ({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords },
    });
    const cases: [string, GeoJSON.Feature][] = [
      [
        "a line from Los Angeles to Honolulu",
        line([
          [-118.2, 34],
          [-157.8, 21.3],
        ]),
      ],
      [
        "a polygon over Florida and Puerto Rico",
        polygon([
          [-82, 26],
          [-80, 28],
          [-64, 19],
          [-65, 17],
          [-82, 26],
        ]),
      ],
      [
        "a ring that starts west of Alaska's clip",
        polygon([
          [165, 52],
          [165, 54],
          [-172, 54],
          [-172, 52],
          [165, 52],
        ]),
      ],
      [
        "a line whose ends are outside the lower-48 clip",
        line([
          [-135, 40],
          [-55, 40],
        ]),
      ],
      [
        "a polygon with a hole around Kansas and no owned vertex",
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-130, 20],
                [-130, 30],
                [-60, 30],
                [-60, 20],
                [-130, 20],
              ],
              [
                [-100, 40],
                [-98, 40],
                [-98, 42],
                [-100, 42],
                [-100, 40],
              ],
            ],
          },
        },
      ],
    ];
    for (const [name, f] of cases) {
      it(`draws ${name} like the multiplex`, () => {
        // Every stream in order, as the multiplex emitted them.
        const expected = mainland(f)! + insets.map((p) => p(f) ?? "").join("");
        expect(expected).toMatch(/^M/);
        expect(routed(f)).toBe(expected);
      });
    }

    it("fits the same extent as before", () => {
      const p = geoAlbersUsaTerritories().fitExtent(
        [
          [0, 0],
          [960, 600],
        ],
        states,
      );
      expect(p.scale()).toBeCloseTo(k, 9);
      expect(p.translate()[0]).toBeCloseTo(t[0], 9);
      expect(p.translate()[1]).toBeCloseTo(t[1], 9);
    });
  });

  // The routed `geoAlbersUsa` stands in for d3's in ChoroplethMap, so it must
  // match d3's own composite exactly: paths, fits and invert.
  describe("geoAlbersUsa", () => {
    const extent: Bounds = [
      [0, 0],
      [960, 600],
    ];
    for (const [name, fc] of [
      ["states", states],
      ["counties", counties],
    ] as const) {
      it(`fits and draws ${name} like d3`, () => {
        const ours = geoAlbersUsa().fitExtent(extent, fc);
        const d3s = d3AlbersUsa().fitExtent(extent, fc);
        expect(ours.scale()).toBe(d3s.scale());
        expect(ours.translate()).toEqual(d3s.translate());
        const routed = geoPath(ours);
        const expected = geoPath(d3s);
        for (const f of fc.features)
          expect(routed(f), String(f.id)).toBe(expected(f));
      });
    }

    it("fits width and height like d3", () => {
      const w = geoAlbersUsa().fitWidth(800, states);
      const wd = d3AlbersUsa().fitWidth(800, states);
      expect([w.scale(), ...w.translate()]).toEqual([
        wd.scale(),
        ...wd.translate(),
      ]);
      const h = geoAlbersUsa().fitHeight(500, states);
      const hd = d3AlbersUsa().fitHeight(500, states);
      expect([h.scale(), ...h.translate()]).toEqual([
        hd.scale(),
        ...hd.translate(),
      ]);
    });

    it("projects and inverts like d3", () => {
      const ours = geoAlbersUsa().fitExtent(extent, states);
      const d3s = d3AlbersUsa().fitExtent(extent, states);
      const points: [number, number][] = [
        [-96, 38.7],
        [-150, 62],
        [-157.8, 21.3],
        [-66.1, 18.4],
        [165, 52],
      ];
      for (const p of points) {
        expect(ours(p), String(p)).toEqual(d3s(p));
        const q = ours(p);
        if (q) expect(ours.invert!(q), String(p)).toEqual(d3s.invert!(q));
      }
    });
  });
});

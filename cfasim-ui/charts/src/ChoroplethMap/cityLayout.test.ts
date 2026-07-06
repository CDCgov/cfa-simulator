import { describe, it, expect } from "vitest";
import {
  layoutCities,
  placedLabelBox,
  rectsOverlap,
  estimateTextWidth,
  type CityMarker,
} from "./cityLayout.js";

// Treat input coordinates as already-canonical so tests control positions
// directly (the real projection is d3's, tested elsewhere).
const identityProject = (c: [number, number]): [number, number] => [c[0], c[1]];

const OPTS = { width: 1000, height: 625, viewScale: 1 };

function city(name: string, x: number, y: number, capital = false): CityMarker {
  return { name, coordinates: [x, y], capital };
}

describe("layoutCities", () => {
  it("culls cities the projection can't place (null) or that fall off-canvas", () => {
    const cities = [
      city("Here", 500, 300),
      city("Null", 0, 0),
      city("OffCanvas", 5000, 300),
    ];
    const project = (c: [number, number]) =>
      c[0] === 0 ? null : (c as [number, number]);
    const placed = layoutCities(cities, project, undefined, OPTS);
    expect(placed.map((p) => p.name)).toEqual(["Here"]);
  });

  it("applies the zoom transform to positions", () => {
    const placed = layoutCities(
      [city("A", 100, 100)],
      identityProject,
      { k: 2, x: 50, y: 10 },
      OPTS,
    );
    expect(placed[0].x).toBe(2 * 100 + 50);
    expect(placed[0].y).toBe(2 * 100 + 10);
  });

  it("orders capitals first regardless of input order", () => {
    const cities = [
      city("Big", 400, 300),
      city("Capital", 600, 300, true),
      city("Small", 500, 300),
    ];
    const placed = layoutCities(cities, identityProject, undefined, OPTS);
    expect(placed[0].name).toBe("Capital");
    expect(placed[0].capital).toBe(true);
  });

  it("renders capitals as plain dots, same radius as other cities", () => {
    const placed = layoutCities(
      [city("Cap", 500, 300, true), city("Dot", 400, 300)],
      identityProject,
      undefined,
      OPTS,
    );
    const cap = placed.find((p) => p.capital)!;
    const dot = placed.find((p) => !p.capital)!;
    expect(cap.radius).toBe(dot.radius);
  });

  it("never lets two placed labels overlap", () => {
    // A dense cluster of long-named cities: many labels can't be placed.
    const cities: CityMarker[] = [];
    for (let i = 0; i < 40; i++) {
      const x = 480 + (i % 8) * 6;
      const y = 290 + Math.floor(i / 8) * 6;
      cities.push(city(`Springfieldville ${i}`, x, y));
    }
    const placed = layoutCities(cities, identityProject, undefined, OPTS);
    const boxes = placed
      .map((p) => placedLabelBox(p, { labelPx: 11, viewScale: 1 }))
      .filter((b): b is NonNullable<typeof b> => b != null);

    // Some labels must have been dropped (the cluster can't fit them all).
    expect(boxes.length).toBeLessThan(cities.length);
    // …and every surviving pair is disjoint.
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(rectsOverlap(boxes[i], boxes[j])).toBe(false);
      }
    }
  });

  it("always labels a capital even when surrounded by dense dots", () => {
    const cities: CityMarker[] = [
      { name: "Capitalville", coordinates: [500, 300], capital: true },
    ];
    for (let i = 0; i < 12; i++) {
      cities.push(
        city(`Neighbor ${i}`, 500 + Math.cos(i) * 4, 300 + Math.sin(i) * 4),
      );
    }
    const placed = layoutCities(cities, identityProject, undefined, OPTS);
    const cap = placed.find((p) => p.capital)!;
    expect(cap.label).not.toBeNull();
  });

  it("keeps the dot even when the label is dropped", () => {
    const cities: CityMarker[] = [];
    for (let i = 0; i < 40; i++) {
      cities.push(city(`Metropolis ${i}`, 500 + (i % 5), 300 + (i % 5)));
    }
    const placed = layoutCities(cities, identityProject, undefined, OPTS);
    // Every kept city has a dot; at least one had its label suppressed.
    expect(placed.length).toBe(cities.length);
    expect(placed.some((p) => p.label == null)).toBe(true);
    expect(
      placed.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    ).toBe(true);
  });

  it("does not place a label overlapping any dot", () => {
    const cities = [city("A", 500, 300), city("B", 512, 300)];
    const placed = layoutCities(cities, identityProject, undefined, OPTS);
    const dotBoxes = placed.map((p) => ({
      x0: p.x - p.radius,
      y0: p.y - p.radius,
      x1: p.x + p.radius,
      y1: p.y + p.radius,
    }));
    for (const p of placed) {
      const box = placedLabelBox(p, { labelPx: 11, viewScale: 1 });
      if (!box) continue;
      for (const d of dotBoxes) {
        expect(rectsOverlap(box, d)).toBe(false);
      }
    }
  });

  it("scales marker/label geometry down as viewScale grows", () => {
    const at1 = layoutCities(
      [city("A", 500, 300)],
      identityProject,
      undefined,
      {
        ...OPTS,
        viewScale: 1,
      },
    );
    const at2 = layoutCities(
      [city("A", 500, 300)],
      identityProject,
      undefined,
      {
        ...OPTS,
        viewScale: 2,
      },
    );
    // Radius is px / viewScale, so doubling viewScale halves canonical radius.
    expect(at2[0].radius).toBeCloseTo(at1[0].radius / 2, 5);
  });
});

describe("estimateTextWidth", () => {
  it("scales with text length and font size", () => {
    expect(estimateTextWidth("abcd", 10)).toBeGreaterThan(
      estimateTextWidth("ab", 10),
    );
    expect(estimateTextWidth("ab", 20)).toBeGreaterThan(
      estimateTextWidth("ab", 10),
    );
  });
});

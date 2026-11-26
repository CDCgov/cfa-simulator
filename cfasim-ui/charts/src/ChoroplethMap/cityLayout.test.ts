import { describe, it, expect } from "vitest";
import {
  layoutCities,
  placedLabelBox,
  rectsOverlap,
  type CityMarker,
} from "./cityLayout.js";

const identityProject = (coord: [number, number]): [number, number] => [
  coord[0],
  coord[1],
];
const defaultOpts = { width: 1000, height: 625, viewScale: 1 };

function makeCity(
  name: string,
  x: number,
  y: number,
  capital = false,
): CityMarker {
  return { name, coordinates: [x, y], capital };
}

describe("layoutCities", () => {
  it("culls unprojectable/off-canvas cities and applies zoom transform", () => {
    const cities = [
      makeCity("Here", 100, 100),
      makeCity("Null", 0, 0),
      makeCity("OffCanvas", 5000, 300),
    ];
    const project = (coord: [number, number]) =>
      coord[0] === 0 ? null : coord;
    const placed = layoutCities(
      cities,
      project,
      { k: 2, x: 50, y: 10 },
      defaultOpts,
    );
    expect(placed).toHaveLength(1);
    expect(placed[0].name).toBe("Here");
    expect(placed[0].x).toBe(250);
    expect(placed[0].y).toBe(210);
  });

  it("prioritizes capitals, avoids overlapping labels or dots, and keeps dots when labels drop", () => {
    const cities: CityMarker[] = [];
    for (let idx = 0; idx < 30; idx++) {
      const x = 480 + (idx % 6) * 6;
      const y = 290 + Math.floor(idx / 6) * 6;
      cities.push(makeCity(`Springfieldville ${idx}`, x, y));
    }
    cities.push(makeCity("Capitalville", 495, 300, true));

    const placed = layoutCities(
      cities,
      identityProject,
      undefined,
      defaultOpts,
    );
    expect(placed).toHaveLength(cities.length);
    expect(placed[0].name).toBe("Capitalville");
    expect(placed[0].label).not.toBeNull();
    expect(placed.some((item) => item.label == null)).toBe(true);

    const boxes = placed
      .map((item) => placedLabelBox(item, { labelPx: 11, viewScale: 1 }))
      .filter((box): box is NonNullable<typeof box> => box != null);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(rectsOverlap(boxes[i], boxes[j])).toBe(false);
      }
    }
  });

  it("scales marker radius inversely with viewScale", () => {
    const atOne = layoutCities(
      [makeCity("A", 500, 300)],
      identityProject,
      undefined,
      { ...defaultOpts, viewScale: 1 },
    );
    const atTwo = layoutCities(
      [makeCity("A", 500, 300)],
      identityProject,
      undefined,
      { ...defaultOpts, viewScale: 2 },
    );
    expect(atTwo[0].radius).toBeCloseTo(atOne[0].radius / 2, 5);
  });
});

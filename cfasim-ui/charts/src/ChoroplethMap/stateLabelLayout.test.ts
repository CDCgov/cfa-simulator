import { describe, it, expect } from "vitest";
import {
  layoutStateLabels,
  type StateLabelFeature,
  type PlacedStateLabel,
} from "./stateLabelLayout";
import {
  rectsOverlap,
  boxFor,
  LINE_HEIGHT,
  type LabelRect,
} from "./cityLayout";

const defaultOpts = { width: 1000, height: 600, viewScale: 1 };
const LABEL_PX = 11;

function makeSquare(
  id: string,
  abbr: string,
  x0: number,
  y0: number,
  size: number,
): StateLabelFeature {
  const ring: [number, number][] = [
    [x0, y0],
    [x0 + size, y0],
    [x0 + size, y0 + size],
    [x0, y0 + size],
    [x0, y0],
  ];
  const center: [number, number] = [x0 + size / 2, y0 + size / 2];
  return {
    id,
    abbr,
    centroid: center,
    anchor: center,
    bounds: { x0, y0, x1: x0 + size, y1: y0 + size },
    rings: [ring],
  };
}

function labelBox(placed: PlacedStateLabel): LabelRect {
  return boxFor(
    placed.x,
    placed.y,
    placed.w,
    LABEL_PX * LINE_HEIGHT,
    placed.anchor,
  );
}

describe("layoutStateLabels", () => {
  it("places fitting labels inside, and tiny states as callouts with leaders when displaced", () => {
    const tiny = makeSquare("02", "BB", 600, 300, 8);
    const landEast = makeSquare("03", "CC", 620, 250, 100);
    const landWest = makeSquare("04", "DD", 480, 250, 120);
    const placed = layoutStateLabels(
      [tiny, landEast, landWest],
      undefined,
      defaultOpts,
    );

    const east = placed.find((item) => item.id === "03")!;
    expect(east.placement).toBe("inside");
    expect(east.leader).toBeNull();

    const callout = placed.find((item) => item.id === "02")!;
    expect(callout.placement).toBe("callout");
    expect(callout.anchor).toBe("start");
    expect(labelBox(callout).x0).toBeGreaterThan(720);
    expect(callout.leader).not.toBeNull();
  });

  it("stacks colliding callouts without overlap", () => {
    const first = makeSquare("02", "BB", 700, 300, 8);
    const second = makeSquare("03", "CC", 700, 306, 8);
    const placed = layoutStateLabels([first, second], undefined, defaultOpts);
    expect(placed).toHaveLength(2);
    expect(placed.every((item) => item.placement === "callout")).toBe(true);
    expect(rectsOverlap(labelBox(placed[0]), labelBox(placed[1]))).toBe(false);
  });

  it("drops unreachable callouts and out-of-viewport states", () => {
    const tiny = makeSquare("02", "BB", 600, 300, 8);
    const landEast = makeSquare("03", "CC", 620, 100, 300);
    const landWest = makeSquare("04", "DD", 300, 100, 300);
    const offscreen = makeSquare("05", "EE", 2000, 300, 100);
    const placed = layoutStateLabels(
      [tiny, landEast, landWest, offscreen],
      undefined,
      defaultOpts,
    );
    expect(placed.find((item) => item.id === "02")).toBeUndefined();
    expect(placed.find((item) => item.id === "05")).toBeUndefined();
  });

  it("re-fits callouts to inside under zoom and clamps zoomed-in offscreen centroids", () => {
    const tiny = makeSquare("02", "BB", 700, 300, 8);
    expect(layoutStateLabels([tiny], undefined, defaultOpts)[0].placement).toBe(
      "callout",
    );
    const zoomedTiny = layoutStateLabels(
      [tiny],
      { k: 10, x: -6500, y: -2700 },
      defaultOpts,
    );
    expect(zoomedTiny[0].placement).toBe("inside");

    const big = makeSquare("01", "AA", 100, 100, 200);
    const [clamped] = layoutStateLabels(
      [big],
      { k: 5, x: -1200, y: -600 },
      defaultOpts,
    );
    expect(clamped.placement).toBe("inside");
    expect(clamped.x).toBeLessThan(40);
    expect(clamped.y).toBeCloseTo(400);
  });
});

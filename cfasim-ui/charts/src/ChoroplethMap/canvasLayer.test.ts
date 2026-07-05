import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildScene,
  drawScene,
  buildPicking,
  pickIndexAt,
  indexToColor,
  type CanvasScene,
} from "./canvasLayer.js";

// happy-dom has no Path2D / 2D context — record operations instead.
class FakePath2D {
  constructor(public d?: string) {}
  addPath(p: FakePath2D) {
    this.d = (this.d ?? "") + (p.d ?? "");
  }
}

interface RecordingCtx extends CanvasRenderingContext2D {
  ops: string[];
}

function fakeCtx(overrides: Record<string, unknown> = {}): RecordingCtx {
  const ops: string[] = [];
  const ctx = {
    canvas: { width: 1000, height: 625 },
    lineWidth: 0,
    lineJoin: "miter",
    lineCap: "butt",
    fillStyle: "",
    strokeStyle: "",
    imageSmoothingEnabled: true,
    setTransform: vi.fn((...args: number[]) => {
      if (args.length === 6) ops.push(`transform:${args.join(",")}`);
    }),
    clearRect: vi.fn(),
    fill: vi.fn(function (this: void, p: FakePath2D) {
      ops.push(`fill:${p.d}:${(ctx as { fillStyle: string }).fillStyle}`);
    }),
    stroke: vi.fn(function (this: void, p: FakePath2D) {
      const c = ctx as { strokeStyle: string; lineWidth: number };
      ops.push(`stroke:${p.d}:${c.strokeStyle}@${c.lineWidth}`);
    }),
    setLineDash: vi.fn(),
    getImageData: vi.fn(),
    isPointInPath: vi.fn(() => true),
    ops,
    ...overrides,
  };
  return ctx as unknown as RecordingCtx;
}

function scene3(): CanvasScene {
  const items = ["a", "b", "c"].map((id, i) => ({
    id,
    path: new FakePath2D(`M${i}`) as unknown as Path2D,
    fill: `#f${i}`,
  }));
  return {
    items,
    indexById: new Map(items.map((it, i) => [it.id, i])),
    outlines: new FakePath2D("M0M1M2") as unknown as Path2D,
    borders: new FakePath2D("Mborders") as unknown as Path2D,
  };
}

beforeEach(() => {
  vi.stubGlobal("Path2D", FakePath2D);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildScene", () => {
  it("builds one item per feature, skipping features without a path", () => {
    const scene = buildScene(
      [{ id: "01" }, { id: "02" }, { id: "03" }],
      ((f: { id: string }) => (f.id === "02" ? null : `M${f.id}`)) as never,
      (id) => `fill-${id}`,
      "Mborders",
    );
    expect(scene.items.map((i) => i.id)).toEqual(["01", "03"]);
    expect(scene.items[0].fill).toBe("fill-01");
    expect(scene.indexById.get("03")).toBe(1);
    // All feature outlines concatenated for one native stroke call.
    expect((scene.outlines as unknown as FakePath2D).d).toBe("M01M03");
    expect((scene.borders as unknown as FakePath2D).d).toBe("Mborders");
  });
});

describe("drawScene", () => {
  const view = {
    dpr: 2,
    meetScale: 0.5,
    offsetX: 0,
    offsetY: 10,
    zoom: { k: 4, x: -100, y: -50 },
  };

  it("applies the composed transform and constant-CSS-px line widths", () => {
    const ctx = fakeCtx();
    drawScene(ctx, scene3(), view, {
      strokeColor: "#fff",
      strokeWidth: 0.5,
      highlightStroke: "#000",
      hoveredId: null,
      focused: new Map(),
      overlays: [],
    });
    // device = dpr·(offset + meetScale·zoom(point)) → scale 2·0.5·4 = 4,
    // tx = 2·(0 + 0.5·−100) = −100, ty = 2·(10 + 0.5·−50) = −30.
    expect(ctx.ops).toContain("transform:4,0,0,4,-100,-30");
    // Feature outlines stroke once, 0.5 CSS px → 0.5/(0.5·4) = 0.25 map
    // units; borders 1 CSS px → 0.5.
    expect(ctx.ops).toContain("stroke:M0M1M2:#fff@0.25");
    expect(ctx.ops).toContain("stroke:Mborders:#fff@0.5");
  });

  it("draws fills, borders, overlays, then highlights last", () => {
    const ctx = fakeCtx();
    drawScene(ctx, scene3(), view, {
      strokeColor: "#fff",
      strokeWidth: 0.5,
      highlightStroke: "#000",
      hoveredId: "b",
      focused: new Map([["c", { stroke: "red", strokeWidth: 3 }]]),
      overlays: [
        {
          path: new FakePath2D("Mov") as unknown as Path2D,
          stroke: "#666",
          style: "dashed",
        },
      ],
    });
    const order = ctx.ops.filter((o) => !o.startsWith("transform"));
    // Base pass: every feature fills, then one outline stroke.
    expect(order.slice(0, 4)).toEqual([
      "fill:M0:#f0",
      "fill:M1:#f1",
      "fill:M2:#f2",
      "stroke:M0M1M2:#fff@0.25",
    ]);
    // Overlay before highlights, highlights at the very end, focused item
    // with custom stroke/width (3 CSS px → 1.5 map units) and hovered item
    // with the default highlight color (0.5+1 → 0.75).
    const ovIdx = order.indexOf("stroke:Mov:#666@1");
    expect(ovIdx).toBeGreaterThan(-1);
    expect(order.at(-1)).toBe("stroke:M1:#000@0.75");
    expect(order.at(-3)).toBe("stroke:M2:red@1.5");
    expect(order.indexOf("stroke:M2:red@1.5")).toBeGreaterThan(ovIdx);
  });
});

describe("picking", () => {
  it("buildPicking fills every feature in its index color", () => {
    const ctx = fakeCtx();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
    } as unknown as HTMLCanvasElement;
    const out = buildPicking(scene3(), 1000, 625, canvas);
    expect(out).toBe(ctx);
    expect(canvas.width).toBe(1000);
    expect(ctx.ops.filter((o) => o.startsWith("fill:"))).toEqual([
      `fill:M0:${indexToColor(0)}`,
      `fill:M1:${indexToColor(1)}`,
      `fill:M2:${indexToColor(2)}`,
    ]);
  });

  it("decodes the sampled index color", () => {
    const ctx = fakeCtx({
      getImageData: vi.fn(() => ({ data: [0, 0, 3, 255] })),
    });
    expect(pickIndexAt(ctx, scene3(), 10, 10)).toBe(2);
  });

  it("returns null on background and out of bounds", () => {
    const ctx = fakeCtx({
      getImageData: vi.fn(() => ({ data: [0, 0, 0, 0] })),
    });
    expect(pickIndexAt(ctx, scene3(), 10, 10)).toBeNull();
    expect(pickIndexAt(ctx, scene3(), -5, 10)).toBeNull();
    expect(pickIndexAt(ctx, scene3(), 10, 99999)).toBeNull();
  });

  it("falls back to isPointInPath when an edge pixel decodes wrong", () => {
    const scene = scene3();
    const ctx = fakeCtx({
      // Blended edge pixel decoding to index 1...
      getImageData: vi.fn(() => ({ data: [0, 0, 2, 255] })),
      // ...but the point is actually inside feature 0.
      isPointInPath: vi.fn(
        (p: FakePath2D) => p === (scene.items[0].path as never),
      ),
    });
    expect(pickIndexAt(ctx, scene, 10, 10)).toBe(0);
  });
});

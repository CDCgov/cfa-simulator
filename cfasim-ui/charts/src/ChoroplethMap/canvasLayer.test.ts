import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildScene,
  drawScene,
  buildPicking,
  pickIndexAt,
  indexToColor,
  type CanvasScene,
} from "./canvasLayer.js";

class FakePath2D {
  constructor(public d?: string) {}
  addPath(path: FakePath2D) {
    this.d = (this.d ?? "") + (path.d ?? "");
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
    fillRect: vi.fn((...args: number[]) =>
      ops.push(
        `fillRect:${args.join(",")}:${(ctx as { fillStyle: string }).fillStyle}`,
      ),
    ),
    fill: vi.fn((path: FakePath2D) =>
      ops.push(`fill:${path.d}:${(ctx as { fillStyle: string }).fillStyle}`),
    ),
    stroke: vi.fn((path: FakePath2D) => {
      const state = ctx as { strokeStyle: string; lineWidth: number };
      ops.push(`stroke:${path.d}:${state.strokeStyle}@${state.lineWidth}`);
    }),
    setLineDash: vi.fn(),
    getImageData: vi.fn(),
    isPointInPath: vi.fn(() => true),
    ops,
    ...overrides,
  };
  return ctx as unknown as RecordingCtx;
}

function makeScene(): CanvasScene {
  const items = ["a", "b", "c"].map((id, idx) => ({
    id,
    path: new FakePath2D(`M${idx}`) as unknown as Path2D,
    fill: `#f${idx}`,
  }));
  return {
    items,
    indexById: new Map(items.map((item, idx) => [item.id, idx])),
    featureStrokes: new FakePath2D("M0M1M2") as unknown as Path2D,
    alternateFeatureStrokes: new Map(),
    raisedStroke: null,
    raisedStrokeColor: undefined,
    raisedId: null,
    borders: new FakePath2D("Mborders") as unknown as Path2D,
    countyBorders: null,
    hsaBorders: null,
    exterior: null,
  };
}

const baseState = () => ({
  strokeColor: "#fff",
  strokeWidth: 0.5,
  bordersColor: "#fff",
  bordersWidth: 1,
  countyBordersColor: undefined as string | undefined,
  countyBordersWidth: 0.5,
  hsaBordersColor: undefined as string | undefined,
  hsaBordersWidth: 0.5,
  outlineColor: undefined as string | undefined,
  outlineWidth: 1,
  background: undefined as string | undefined,
  highlightStroke: "#000",
  hoveredId: null as string | null,
  focused: new Map(),
  overlays: [],
});

beforeEach(() => vi.stubGlobal("Path2D", FakePath2D));
afterEach(() => vi.unstubAllGlobals());

describe("canvasLayer", () => {
  const view = {
    dpr: 2,
    meetScale: 0.5,
    offsetX: 0,
    offsetY: 10,
    zoom: { k: 4, x: -100, y: -50 },
  };

  it("buildScene skips null paths and batches alternate strokes", () => {
    const scene = buildScene(
      [{ id: "01" }, { id: "02" }, { id: "03" }],
      ((feat: { id: string }) =>
        feat.id === "02" ? null : `M${feat.id}`) as never,
      (id) => `fill-${id}`,
      "Mborders",
      null,
      (id) => (id === "03" ? "#ccc" : undefined),
    );
    expect(scene.items.map((item) => item.id)).toEqual(["01", "03"]);
    expect((scene.featureStrokes as unknown as FakePath2D).d).toBe("M01");
    expect(
      (scene.alternateFeatureStrokes.get("#ccc") as unknown as FakePath2D).d,
    ).toBe("M03");
    expect((scene.borders as unknown as FakePath2D).d).toBe("Mborders");
  });

  it("drawScene applies transform, constant-CSS-px widths, and layer z-order", () => {
    const ctx = fakeCtx();
    const scene = makeScene();
    scene.countyBorders = new FakePath2D("Mcounty") as unknown as Path2D;
    scene.hsaBorders = new FakePath2D("Mhsa") as unknown as Path2D;
    scene.exterior = new FakePath2D("Mext") as unknown as Path2D;

    drawScene(ctx, scene, view, {
      ...baseState(),
      background: "#123",
      countyBordersColor: "#999",
      hsaBordersColor: "#eee",
      outlineColor: "#0a0",
      outlineWidth: 2,
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

    expect(ctx.ops).toContain("transform:4,0,0,4,-100,-30");
    const order = ctx.ops.filter((op) => !op.startsWith("transform"));
    expect(order.slice(0, 5)).toEqual([
      "fillRect:0,0,1000,625:#123",
      "fill:M0:#f0",
      "fill:M1:#f1",
      "fill:M2:#f2",
      "stroke:M0M1M2:#fff@0.25",
    ]);
    const indices = [
      "stroke:Mcounty:#999@0.25",
      "stroke:Mhsa:#eee@0.25",
      "stroke:Mborders:#fff@0.5",
      "stroke:Mext:#0a0@1",
      "stroke:M2:red@1.5",
      "stroke:Mov:#666@1",
      "stroke:M1:#000@0.75",
    ].map((op) => order.indexOf(op));
    for (let idx = 0; idx < indices.length; idx++) {
      expect(indices[idx]).toBeGreaterThan(-1);
      if (idx > 0) expect(indices[idx]).toBeGreaterThan(indices[idx - 1]);
    }
  });

  it("drawScene skips optional layers when unset or width is 0", () => {
    const ctx = fakeCtx();
    const scene = makeScene();
    scene.countyBorders = new FakePath2D("Mcounty") as unknown as Path2D;
    scene.hsaBorders = new FakePath2D("Mhsa") as unknown as Path2D;
    scene.exterior = new FakePath2D("Mext") as unknown as Path2D;
    drawScene(ctx, scene, view, {
      ...baseState(),
      strokeWidth: 0,
      bordersWidth: 0,
      countyBordersColor: "#999",
      countyBordersWidth: 0,
      hsaBordersColor: "#eee",
      hsaBordersWidth: 0,
      outlineColor: "#0a0",
      outlineWidth: 0,
    });
    expect(
      ctx.ops.some(
        (op) => op.startsWith("fillRect") || op.startsWith("stroke"),
      ),
    ).toBe(false);
  });

  it("picking encodes feature indices and decodes hits, misses, and edge fallback", () => {
    const scene = makeScene();
    const pickCtx = fakeCtx();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => pickCtx),
    } as unknown as HTMLCanvasElement;
    expect(buildPicking(scene, 1000, 625, canvas)).toBe(pickCtx);
    expect(pickCtx.ops.filter((op) => op.startsWith("fill:"))).toEqual([
      `fill:M0:${indexToColor(0)}`,
      `fill:M1:${indexToColor(1)}`,
      `fill:M2:${indexToColor(2)}`,
    ]);

    expect(
      pickIndexAt(
        fakeCtx({ getImageData: vi.fn(() => ({ data: [0, 0, 3, 255] })) }),
        scene,
        10,
        10,
      ),
    ).toBe(2);
    const missCtx = fakeCtx({
      getImageData: vi.fn(() => ({ data: [0, 0, 0, 0] })),
    });
    expect(pickIndexAt(missCtx, scene, 10, 10)).toBeNull();
    expect(pickIndexAt(missCtx, scene, -5, 10)).toBeNull();

    const edgeCtx = fakeCtx({
      getImageData: vi.fn(() => ({ data: [0, 0, 2, 255] })),
      isPointInPath: vi.fn(
        (path: FakePath2D) => path === (scene.items[0].path as never),
      ),
    });
    expect(pickIndexAt(edgeCtx, scene, 10, 10)).toBe(0);
  });
});

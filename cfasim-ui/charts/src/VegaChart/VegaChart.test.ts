import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import VegaChart from "./VegaChart.vue";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import type { ChartMenuItem } from "../ChartMenu/ChartMenu.vue";
import * as download from "../ChartMenu/download.js";

const { embedMock, finalizeSpy, toSVGSpy, toImageURLSpy } = vi.hoisted(() => {
  const finalizeSpy = vi.fn();
  const toSVGSpy = vi.fn(async () => "<svg></svg>");
  const toImageURLSpy = vi.fn(async () => "data:image/png;base64,AAAA");
  const view = { toSVG: toSVGSpy, toImageURL: toImageURLSpy };
  const embedMock = vi.fn(
    async (el: HTMLElement, spec: unknown, opts: unknown) => ({
      view,
      finalize: finalizeSpy,
      spec,
      vgSpec: {},
      embedOptions: opts,
    }),
  );
  return { embedMock, finalizeSpy, toSVGSpy, toImageURLSpy };
});

vi.mock("vega-embed", () => ({ default: embedMock }));

// happy-dom's fetch isn't needed — stub it for the PNG export path.
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ blob: async () => new Blob(["x"]) })),
  );
});

const BAR_SPEC = {
  mark: "bar",
  encoding: {
    x: { field: "a", type: "ordinal" },
    y: { field: "b", type: "quantitative" },
  },
} as const;

async function mountChart(props: Record<string, unknown>) {
  const wrapper = mount(VegaChart, { props: { spec: BAR_SPEC, ...props } });
  await flushPromises();
  await flushPromises();
  return wrapper;
}

/** The (el, spec, opts) of the most recent embed call. */
function lastEmbed() {
  const calls = embedMock.mock.calls;
  const [, spec, opts] = calls[calls.length - 1] as [
    HTMLElement,
    Record<string, unknown>,
    Record<string, unknown>,
  ];
  return { spec, opts };
}

describe("VegaChart", () => {
  it("embeds the spec on mount and emits viewReady", async () => {
    const wrapper = await mountChart({});
    expect(embedMock).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("viewReady")).toHaveLength(1);
  });

  it("defaults to container sizing when width/height are unset", async () => {
    await mountChart({});
    const { spec } = lastEmbed();
    expect(spec.width).toBe("container");
    expect(spec.height).toBe("container");
  });

  it("uses explicit width/height when provided", async () => {
    await mountChart({ width: 500, height: 250 });
    const { spec } = lastEmbed();
    expect(spec.width).toBe(500);
    expect(spec.height).toBe(250);
  });

  it("injects autosize:fit for container sizing so axes aren't clipped", async () => {
    await mountChart({ height: 250 }); // width omitted → "container"
    const { spec } = lastEmbed();
    expect(spec.width).toBe("container");
    expect(spec.autosize).toEqual({ type: "fit", contains: "padding" });
  });

  it("does not inject autosize when both dimensions are explicit", async () => {
    await mountChart({ width: 500, height: 250 });
    expect(lastEmbed().spec.autosize).toBeUndefined();
  });

  it("respects a spec's own autosize", async () => {
    await mountChart({ spec: { ...BAR_SPEC, autosize: "pad" } });
    expect(lastEmbed().spec.autosize).toBe("pad");
  });

  it("does not mutate the source spec", async () => {
    const spec = structuredClone(BAR_SPEC) as Record<string, unknown>;
    await mountChart({ spec, data: [{ a: 1, b: 2 }] });
    expect(spec.data).toBeUndefined();
    expect(spec.width).toBeUndefined();
  });

  describe("data merge", () => {
    it("injects a row array as the primary inline dataset", async () => {
      const rows = [
        { a: "x", b: 1 },
        { a: "y", b: 2 },
      ];
      await mountChart({ data: rows });
      const { spec } = lastEmbed();
      expect(spec.data).toEqual({ values: rows });
    });

    it("zips columnar data into rows", async () => {
      await mountChart({
        data: { a: ["x", "y"], b: new Float64Array([1, 2]) },
      });
      const { spec } = lastEmbed();
      expect(spec.data).toEqual({
        values: [
          { a: "x", b: 1 },
          { a: "y", b: 2 },
        ],
      });
    });

    it("fills named datasets from a record of row arrays", async () => {
      const spec = {
        data: { name: "table" },
        mark: "line",
        encoding: {},
      };
      await mountChart({
        spec,
        data: { table: [{ a: 1 }], other: [{ b: 2 }] },
      });
      const merged = lastEmbed().spec;
      expect(merged.datasets).toEqual({
        table: [{ a: 1 }],
        other: [{ b: 2 }],
      });
      // Existing named data reference is preserved.
      expect(merged.data).toEqual({ name: "table" });
    });

    it("leaves an existing primary dataset untouched", async () => {
      const spec = {
        data: { values: [{ a: 9 }] },
        mark: "bar",
        encoding: {},
      };
      await mountChart({ spec, data: [{ a: 1 }] });
      expect(lastEmbed().spec.data).toEqual({ values: [{ a: 9 }] });
    });
  });

  describe("config / theming", () => {
    it("applies the auto theme config by default", async () => {
      await mountChart({});
      const cfg = lastEmbed().opts.config as Record<string, unknown>;
      expect(cfg.axis).toBeTypeOf("object");
      expect(cfg.legend).toBeTypeOf("object");
      expect(
        (cfg.range as { category: unknown[] }).category.length,
      ).toBeGreaterThan(1);
    });

    it("omits the theme config when theme=false", async () => {
      await mountChart({ theme: false });
      expect(lastEmbed().opts.config).toEqual({});
    });

    it("merges user config over the theme (user wins)", async () => {
      await mountChart({
        theme: false,
        config: { background: "#123456", axis: { labelColor: "#abcdef" } },
      });
      const cfg = lastEmbed().opts.config as Record<
        string,
        Record<string, unknown>
      >;
      expect(cfg.background).toBe("#123456");
      expect(cfg.axis.labelColor).toBe("#abcdef");
    });
  });

  describe("embed options", () => {
    it("forwards renderer, actions and tooltip", async () => {
      await mountChart({ renderer: "canvas", actions: true, tooltip: false });
      const { opts } = lastEmbed();
      expect(opts.renderer).toBe("canvas");
      expect(opts.actions).toBe(true);
      expect(opts.tooltip).toBe(false);
    });

    it("defaults to svg renderer, no actions, tooltip on", async () => {
      await mountChart({});
      const { opts } = lastEmbed();
      expect(opts.renderer).toBe("svg");
      expect(opts.actions).toBe(false);
      expect(opts.tooltip).toBe(true);
    });
  });

  describe("menu / export", () => {
    function items(wrapper: ReturnType<typeof mount>): ChartMenuItem[] {
      return wrapper.findComponent(ChartMenu).props("items") as ChartMenuItem[];
    }

    it("exports SVG via the view and downloadBlob", async () => {
      const blobSpy = vi
        .spyOn(download, "downloadBlob")
        .mockImplementation(() => {});
      const wrapper = await mountChart({ filename: "plot" });
      const svg = items(wrapper).find((i) => i.label === "Save as SVG")!;
      svg.action();
      await flushPromises();
      expect(toSVGSpy).toHaveBeenCalled();
      expect(blobSpy).toHaveBeenCalledWith(expect.any(Blob), "plot.svg");
    });

    it("exports PNG via the view image url", async () => {
      const blobSpy = vi
        .spyOn(download, "downloadBlob")
        .mockImplementation(() => {});
      const wrapper = await mountChart({ filename: "plot" });
      const png = items(wrapper).find((i) => i.label === "Save as PNG")!;
      png.action();
      await flushPromises();
      expect(toImageURLSpy).toHaveBeenCalledWith("png", 2);
      expect(blobSpy).toHaveBeenCalledWith(expect.any(Blob), "plot.png");
    });

    it("offers Download CSV for tabular data", async () => {
      const wrapper = await mountChart({ data: [{ a: 1, b: 2 }] });
      expect(items(wrapper).some((i) => i.label === "Download CSV")).toBe(true);
    });

    it("omits Download CSV for named datasets (non-tabular)", async () => {
      const wrapper = await mountChart({
        spec: { data: { name: "t" }, mark: "bar", encoding: {} },
        data: { t: [{ a: 1 }] },
      });
      expect(items(wrapper).some((i) => i.label === "Download CSV")).toBe(
        false,
      );
    });

    it("hides the menu when menu=false", async () => {
      const wrapper = await mountChart({ menu: false });
      expect(wrapper.findComponent(ChartMenu).exists()).toBe(false);
    });
  });

  describe("re-render lifecycle", () => {
    it("finalizes the previous view before re-embedding on spec change", async () => {
      const wrapper = await mountChart({});
      expect(embedMock).toHaveBeenCalledTimes(1);
      expect(finalizeSpy).not.toHaveBeenCalled();

      await wrapper.setProps({
        spec: { mark: "line", encoding: {} },
      });
      await flushPromises();
      expect(embedMock).toHaveBeenCalledTimes(2);
      expect(finalizeSpy).toHaveBeenCalledTimes(1);
    });

    it("finalizes the view on unmount", async () => {
      const wrapper = await mountChart({});
      wrapper.unmount();
      expect(finalizeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("enters the error state and emits error when embed rejects", async () => {
      embedMock.mockRejectedValueOnce(new Error("boom"));
      const wrapper = await mountChart({});
      expect(wrapper.emitted("error")).toHaveLength(1);
      expect(wrapper.find(".vega-chart-error").exists()).toBe(true);
    });
  });
});

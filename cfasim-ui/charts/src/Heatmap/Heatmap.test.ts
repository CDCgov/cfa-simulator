import { describe, it, expect, vi } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import Heatmap from "./Heatmap.vue";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import * as download from "../ChartMenu/download.js";

const base = {
  rows: ["AZ", "CA"],
  columns: ["a", "b", "c"],
  data: [
    [0, 0.5, 1],
    [1, NaN, 0],
  ],
  width: 400,
  height: 200,
  menu: false,
};

const mono = { range: ["#000000", "#ffffff"] };

function cells(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-testid="cell"]');
}

/** Client coordinates at the center of cell (r, c), from the overlay's attrs. */
function cellCenter(wrapper: ReturnType<typeof mount>, r: number, c: number) {
  const o = wrapper.get('[data-testid="chart-overlay"]').attributes();
  const x = Number(o.x);
  const y = Number(o.y);
  const w = Number(o.width) / base.columns.length;
  const h = Number(o.height) / base.rows.length;
  return { clientX: x + (c + 0.5) * w, clientY: y + (r + 0.5) * h };
}

describe("Heatmap", () => {
  it("draws one cell per finite value, colored by the scale", () => {
    const wrapper = mount(Heatmap, { props: { ...base, colorScale: mono } });
    const rects = cells(wrapper);
    expect(rects.length).toBe(5);
    expect(rects[0].attributes("fill")).toBe("#000000");
    expect(rects[2].attributes("fill")).toBe("#ffffff");
    expect(rects[1].attributes("fill")).toMatch(/^rgb\(/);
    expect(rects[3].attributes()).toMatchObject({
      "data-row": "1",
      "data-column": "0",
    });
    wrapper.unmount();
  });

  it("fills a missing cell with missingColor only when given", () => {
    const wrapper = mount(Heatmap, {
      props: { ...base, missingColor: "#eeeeee" },
    });
    const rects = cells(wrapper);
    expect(rects.length).toBe(6);
    expect(rects[4].attributes("fill")).toBe("#eeeeee");
    wrapper.unmount();
  });

  it("labels cells with contrast-picked text and the value format", () => {
    const wrapper = mount(Heatmap, {
      props: {
        ...base,
        colorScale: mono,
        cellLabels: true,
        valueFormat: "%.2f",
      },
    });
    const labels = wrapper.findAll('[data-testid="cell-label"]');
    expect(labels.map((l) => l.text())).toEqual([
      "0.00",
      "0.50",
      "1.00",
      "1.00",
      "0.00",
    ]);
    expect(labels[0].attributes("fill")).toBe("#ffffff");
    expect(labels[2].attributes("fill")).toBe("#1a1a1a");
    wrapper.unmount();
  });

  it("leaves labels out of cells too short to hold them", () => {
    const wrapper = mount(Heatmap, {
      props: { ...base, cellLabels: { fontSize: 11 }, height: 70 },
    });
    expect(wrapper.findAll('[data-testid="cell-label"]').length).toBe(0);
    wrapper.unmount();
  });

  it("grows to cellHeight per row when height is unset", () => {
    const { height: _h, ...noHeight } = base;
    const two = mount(Heatmap, { props: { ...noHeight, cellHeight: 20 } });
    const four = mount(Heatmap, {
      props: {
        ...noHeight,
        cellHeight: 20,
        rows: ["a", "b", "c", "d"],
        data: [[1], [2], [3], [4]],
      },
    });
    const h = (w: ReturnType<typeof mount>) =>
      Number(w.get("svg").attributes("height"));
    expect(h(four) - h(two)).toBe(40);
    two.unmount();
    four.unmount();
  });

  it("puts column labels under the plot by default and above it on top", () => {
    const bottom = mount(Heatmap, { props: base });
    const top = mount(Heatmap, {
      props: { ...base, columnAxis: "top", rowHeader: "Location" },
    });
    const labelY = (w: ReturnType<typeof mount>) =>
      Number(w.get('[data-testid="column-label"]').attributes("y"));
    const cellY = (w: ReturnType<typeof mount>) =>
      Number(w.get('[data-testid="cell"]').attributes("y"));
    expect(labelY(bottom)).toBeGreaterThan(cellY(bottom));
    expect(labelY(top)).toBeLessThan(cellY(top));
    expect(top.get('[data-testid="row-header"]').text()).toBe("Location");
    expect(bottom.find('[data-testid="row-header"]').exists()).toBe(false);
    bottom.unmount();
    top.unmount();
  });

  it("rotates column labels by the angle, or automatically when they collide", () => {
    const explicit = mount(Heatmap, {
      props: { ...base, columnLabelAngle: -45 },
    });
    expect(
      explicit.get('[data-testid="column-label"]').attributes("transform"),
    ).toMatch(/^rotate\(-45,/);
    const crowded = mount(Heatmap, {
      props: {
        ...base,
        width: 200,
        columns: ["a long column label", "another long label", "third"],
      },
    });
    expect(
      crowded.get('[data-testid="column-label"]').attributes("transform"),
    ).toMatch(/^rotate\(-(45|90),/);
    expect(
      mount(Heatmap, { props: base })
        .get('[data-testid="column-label"]')
        .attributes("transform"),
    ).toBeUndefined();
    // Clockwise labels read downward, so they start at a bottom tick.
    const clockwise = mount(Heatmap, {
      props: { ...base, columnLabelAngle: 45 },
    });
    expect(
      clockwise.get('[data-testid="column-label"]').attributes("text-anchor"),
    ).toBe("start");
    expect(
      explicit.get('[data-testid="column-label"]').attributes("text-anchor"),
    ).toBe("end");
    clockwise.unmount();
    explicit.unmount();
    crowded.unmount();
  });

  describe("long column labels", () => {
    const longColumns = [
      "Ensemble forecast model",
      "Baseline persistence",
      "Renewal equation",
      "Trend extrapolation",
      "Mechanistic SEIR",
      "Gradient boosting",
      "Random walk drift",
      "Last column long name",
    ];
    const long = {
      ...base,
      rows: ["A", "B", "C"],
      columns: longColumns,
      data: [0, 1, 2].map((r) => longColumns.map((_, c) => r + c)),
      width: 420,
      height: undefined,
    };
    // happy-dom measures nothing, so widths are the chart's estimate.
    const FONT_SIZE = 10;
    const estimate = (text: string) => text.length * FONT_SIZE * 0.6;

    /** Left and right svg x of each tilted label's reach. */
    function labelSpans(wrapper: ReturnType<typeof mount>) {
      return wrapper.findAll('[data-testid="column-label"]').map((label) => {
        const x = Number(label.attributes("x"));
        const angle = Number(
          /rotate\((-?[\d.]+)/.exec(label.attributes("transform")!)![1],
        );
        const rad = (Math.abs(angle) * Math.PI) / 180;
        const reach =
          estimate(label.text()) * Math.cos(rad) +
          (FONT_SIZE / 2) * Math.sin(rad);
        return label.attributes("text-anchor") === "start"
          ? { left: x, right: x + reach }
          : { left: x - reach, right: x };
      });
    }

    it.each([
      ["under the plot", { columnLabelAngle: -45 }],
      ["above the plot", { columnLabelAngle: -45, columnAxis: "top" }],
      ["clockwise", { columnLabelAngle: 45 }],
      ["without row labels", { columnLabelAngle: -45, rowAxis: "none" }],
    ] as const)("keeps tilted labels inside the chart %s", (_, extra) => {
      const wrapper = mount(Heatmap, { props: { ...long, ...extra } });
      const spans = labelSpans(wrapper);
      expect(spans.length).toBe(longColumns.length);
      for (const span of spans) {
        expect(span.left).toBeGreaterThanOrEqual(-0.5);
        expect(span.right).toBeLessThanOrEqual(long.width + 0.5);
      }
      // The padding made the room: no label had to be shortened.
      expect(wrapper.text()).not.toContain("…");
      wrapper.unmount();
    });

    it("shortens labels that side padding alone cannot fit", () => {
      const wrapper = mount(Heatmap, {
        props: {
          ...long,
          columns: longColumns.map((c) => `${c} with a much longer name`),
          columnLabelAngle: -30,
          columnAxis: "top",
        },
      });
      const labels = wrapper.findAll('[data-testid="column-label"]');
      expect(labels[labels.length - 1].text()).toMatch(/…$/);
      for (const span of labelSpans(wrapper)) {
        expect(span.right).toBeLessThanOrEqual(long.width + 0.5);
      }
      wrapper.unmount();
    });

    it("keeps the cells visible under a fixed height by shortening labels", () => {
      const wrapper = mount(Heatmap, {
        props: { ...long, height: 160, columnLabelAngle: -90 },
      });
      const cellHeight = Number(
        wrapper.get('[data-testid="cell"]').attributes("height"),
      );
      expect(cellHeight).toBeGreaterThan(5);
      const labels = wrapper.findAll('[data-testid="column-label"]');
      expect(labels[0].text()).toMatch(/…$/);
      for (const label of labels) {
        expect(estimate(label.text())).toBeLessThanOrEqual(160 * 0.4);
      }
      wrapper.unmount();
    });

    it("pads the side only for the labels as a fixed height shortens them", () => {
      const props = {
        ...long,
        columnLabelAngle: -45,
        rowAxis: "none" as const,
      };
      const plotLeft = (wrapper: ReturnType<typeof mount>) =>
        Number(wrapper.get('[data-testid="chart-overlay"]').attributes("x"));
      const auto = mount(Heatmap, { props });
      const fixed = mount(Heatmap, { props: { ...props, height: 120 } });
      expect(fixed.get('[data-testid="column-label"]').text()).toMatch(/…$/);
      expect(plotLeft(fixed)).toBeLessThan(plotLeft(auto));
      for (const span of labelSpans(fixed)) {
        expect(span.left).toBeGreaterThanOrEqual(-0.5);
      }
      auto.unmount();
      fixed.unmount();
    });

    it("reports the full label from a click on a shortened one", async () => {
      const wrapper = mount(Heatmap, {
        props: { ...long, height: 160, columnLabelAngle: -90 },
      });
      await wrapper.get('[data-testid="column-label"]').trigger("click");
      expect(wrapper.emitted("columnClick")![0]).toEqual([
        { index: 0, label: longColumns[0] },
      ]);
      wrapper.unmount();
    });

    it("reads an angle past a quarter turn as its readable equivalent", () => {
      const wrapper = mount(Heatmap, {
        props: { ...long, columnLabelAngle: 270 },
      });
      const label = wrapper.get('[data-testid="column-label"]');
      expect(label.attributes("transform")).toMatch(/^rotate\(-90,/);
      expect(label.attributes("text-anchor")).toBe("end");
      wrapper.unmount();
    });
  });

  it("treats an empty string entry as missing, like the color scale does", () => {
    const wrapper = mount(Heatmap, {
      props: {
        ...base,
        data: [
          [1, "" as unknown as number, 3],
          [2, 2, 2],
        ],
      },
    });
    expect(cells(wrapper).length).toBe(5);
    wrapper.unmount();
  });

  it("thins row labels that would overlap and drops hidden axes", () => {
    const rows = Array.from({ length: 20 }, (_, i) => `row ${i}`);
    const wrapper = mount(Heatmap, {
      props: { ...base, rows, data: rows.map(() => [1, 2, 3]), height: 120 },
    });
    const labels = wrapper.findAll('[data-testid="row-label"]');
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThan(20);
    const bare = mount(Heatmap, {
      props: { ...base, rowAxis: "none", columnAxis: "none" },
    });
    expect(bare.findAll('[data-testid="row-label"]').length).toBe(0);
    expect(bare.findAll('[data-testid="column-label"]').length).toBe(0);
    wrapper.unmount();
    bare.unmount();
  });

  it("shows the scale legend with formatted ends unless turned off", () => {
    const wrapper = mount(Heatmap, {
      props: {
        ...base,
        valueFormat: "%.1f",
        colorScale: { ...mono, label: "Score" },
      },
    });
    const legend = wrapper.get('[data-testid="legend-color-scale"]');
    expect(legend.findAll("text").map((t) => t.text())).toEqual([
      "Score",
      "0.0",
      "1.0",
    ]);
    const off = mount(Heatmap, {
      props: { ...base, colorScale: { legend: false } },
    });
    expect(off.find('[data-testid="legend-color-scale"]').exists()).toBe(false);
    wrapper.unmount();
    off.unmount();
  });

  it("hovers a cell: tooltip, highlight, hover index and cell-click", async () => {
    const wrapper = mount(Heatmap, {
      props: { ...base, colorScale: mono, tooltipTrigger: "hover" },
    });
    const overlay = wrapper.get('[data-testid="chart-overlay"]');
    const at = cellCenter(wrapper, 1, 2);
    await overlay.trigger("mousemove", at);
    expect(wrapper.emitted("hover")![0][0]).toEqual({ index: 5 });
    const tooltip = wrapper.get(".chart-tooltip-content");
    expect(tooltip.get(".chart-tooltip-label").text()).toBe("CA");
    expect(tooltip.get(".chart-tooltip-name").text()).toBe("c");
    expect(tooltip.get(".chart-tooltip-value").text()).toBe("0");
    const highlight = wrapper.get('[data-testid="cell-highlight"]');
    expect(highlight.attributes("x")).toBe(cells(wrapper)[4].attributes("x"));

    await overlay.trigger("click", at);
    expect(wrapper.emitted("cellClick")![0][0]).toEqual({
      rowIndex: 1,
      columnIndex: 2,
      row: "CA",
      column: "c",
      value: 0,
      color: "#000000",
    });
    // Missing cells show `—` in the tooltip, and default format uses 3 sig figs.
    await overlay.trigger("mousemove", cellCenter(wrapper, 1, 1));
    expect(tooltip.get(".chart-tooltip-name").text()).toBe("b");
    expect(tooltip.get(".chart-tooltip-value").text()).toBe("—");
    await overlay.trigger("mouseleave");
    expect(wrapper.emitted("hover")!.at(-1)![0]).toBeNull();
    wrapper.unmount();
  });

  it("formats tooltip values to three significant digits by default and ignores null in scale domain", async () => {
    const wrapper = mount(Heatmap, {
      props: {
        ...base,
        data: [
          [0.05, 0.42, 1],
          [null as unknown as number, 0.5, 1],
        ],
        colorScale: mono,
        tooltipTrigger: "hover",
      },
    });
    expect(
      wrapper
        .get('[data-testid="legend-color-scale"]')
        .findAll("text")
        .map((t) => t.text()),
    ).toEqual(["0.05", "1"]);
    const overlay = wrapper.get('[data-testid="chart-overlay"]');
    await overlay.trigger("mousemove", cellCenter(wrapper, 0, 0));
    expect(wrapper.get(".chart-tooltip-value").text()).toBe("0.05");
    wrapper.unmount();
  });

  it("emits cell-click even without tooltipTrigger or interactive, and truncates capped row labels", async () => {
    const wrapper = mount(Heatmap, {
      props: {
        ...base,
        rows: ["North Carolina", "CA"],
        rowLabelWidth: 36,
      },
    });
    const rowLabel = wrapper.findAll('[data-testid="row-label"]')[0];
    expect(rowLabel.text()).toBe("North…");
    await rowLabel.trigger("click");
    expect(wrapper.emitted("rowClick")![0][0]).toEqual({
      index: 0,
      label: "North Carolina",
    });
    await wrapper
      .get('[data-testid="chart-overlay"]')
      .trigger("click", cellCenter(wrapper, 0, 1));
    expect(wrapper.emitted("cellClick")![0][0]).toMatchObject({
      row: "North Carolina",
      column: "b",
      value: 0.5,
    });
    wrapper.unmount();
  });

  it("passes the cell to the tooltip slot and applies tooltipTitle", async () => {
    const wrapper = mount(Heatmap, {
      props: {
        ...base,
        tooltipTrigger: "hover",
        tooltipTitle: (label: string) => `Row ${label}`,
      },
      slots: {
        tooltip: `<template #tooltip="p">{{ p.title }}|{{ p.row }}|{{ p.column }}|{{ p.value }}|{{ p.index }}</template>`,
      },
    });
    const overlay = wrapper.get('[data-testid="chart-overlay"]');
    await overlay.trigger("mousemove", cellCenter(wrapper, 0, 1));
    expect(wrapper.get(".chart-tooltip-content").text()).toBe(
      "Row AZ|AZ|b|0.5|1",
    );
    wrapper.unmount();
  });

  it("emits row-click and column-click from the axis labels", async () => {
    const wrapper = mount(Heatmap, { props: base });
    await wrapper.findAll('[data-testid="row-label"]')[1].trigger("click");
    await wrapper.findAll('[data-testid="column-label"]')[2].trigger("click");
    expect(wrapper.emitted("rowClick")![0][0]).toEqual({
      index: 1,
      label: "CA",
    });
    expect(wrapper.emitted("columnClick")![0][0]).toEqual({
      index: 2,
      label: "c",
    });
    wrapper.unmount();
  });

  describe("interactive", () => {
    it("renders a labeled button per cell and row with one tab stop", () => {
      const wrapper = mount(Heatmap, {
        props: { ...base, interactive: true, valueFormat: "%.1f" },
      });
      const buttons = wrapper.findAll(".heatmap-cell-button");
      expect(buttons.length).toBe(2 * 4);
      expect(buttons[0].attributes("aria-label")).toBe("AZ");
      expect(buttons[1].attributes("aria-label")).toBe("AZ, a: 0.0");
      expect(buttons[6].attributes("aria-label")).toBe("CA, b: —");
      expect(
        buttons.filter((b) => b.attributes("tabindex") === "0").length,
      ).toBe(1);
      expect(buttons[1].attributes("tabindex")).toBe("0");
      wrapper.unmount();
    });

    it("moves the tab stop with the arrow keys and clicks through Enter", async () => {
      const wrapper = mount(Heatmap, {
        props: { ...base, interactive: true },
        attachTo: document.body,
      });
      const button = (r: number, c: number) =>
        wrapper.get(`[data-cell="${r}:${c}"]`);
      await button(0, 0).trigger("keydown", { key: "ArrowRight" });
      await nextTick();
      expect(button(0, 1).attributes("tabindex")).toBe("0");
      expect(button(0, 0).attributes("tabindex")).toBe("-1");
      expect(document.activeElement).toBe(button(0, 1).element);
      await button(0, 1).trigger("keydown", { key: "ArrowDown" });
      await button(1, 1).trigger("keydown", { key: "Home" });
      await nextTick();
      expect(button(1, -1).attributes("tabindex")).toBe("0");
      await button(1, -1).trigger("click");
      expect(wrapper.emitted("rowClick")![0][0]).toEqual({
        index: 1,
        label: "CA",
      });
      await button(1, 1).trigger("click");
      expect(wrapper.emitted("cellClick")![0][0]).toMatchObject({
        rowIndex: 1,
        columnIndex: 1,
        value: NaN,
      });
      // The tab stop survives the grid shrinking under it.
      await wrapper.setProps({ rows: ["AZ"], data: [[0, 0.5, 1]] });
      expect(
        wrapper
          .findAll(".heatmap-cell-button")
          .filter((b) => b.attributes("tabindex") === "0").length,
      ).toBe(1);
      wrapper.unmount();
    });

    it("shows the tooltip for a focused cell and hides it on blur", async () => {
      const wrapper = mount(Heatmap, {
        props: { ...base, interactive: true, tooltipTrigger: "hover" },
      });
      await wrapper.get('[data-cell="0:2"]').trigger("focus");
      expect(wrapper.emitted("hover")![0][0]).toEqual({ index: 2 });
      expect(wrapper.get(".chart-tooltip-content").text()).toContain("AZ");
      await wrapper.get('[data-cell="0:2"]').trigger("blur");
      expect(wrapper.emitted("hover")!.at(-1)![0]).toBeNull();
      wrapper.unmount();
    });

    it("hides a cell's tooltip when focus moves to a row label", async () => {
      const wrapper = mount(Heatmap, {
        props: { ...base, interactive: true, tooltipTrigger: "click" },
      });
      // A click-trigger tooltip has no blur on the way, only the new focus.
      await wrapper.get('[data-cell="1:0"]').trigger("focus");
      expect(wrapper.find(".chart-tooltip-content").exists()).toBe(true);
      await wrapper.get('[data-cell="1:-1"]').trigger("focus");
      expect(wrapper.emitted("hover")!.at(-1)![0]).toBeNull();
      expect(wrapper.find(".chart-tooltip-content").exists()).toBe(false);
      wrapper.unmount();
    });

    it("lays the buttons over the svg in a shared wrapper", () => {
      const wrapper = mount(Heatmap, {
        props: { ...base, interactive: true },
      });
      const plot = wrapper.get(".heatmap-plot");
      expect(plot.find(".heatmap-cells").exists()).toBe(true);
      expect(plot.find("svg").exists()).toBe(true);
      wrapper.unmount();
    });
  });

  it("downloads the matrix as CSV with the row header from yLabel", () => {
    const spy = vi.spyOn(download, "downloadCsv").mockImplementation(() => {});
    const wrapper = mount(Heatmap, {
      props: { ...base, menu: true, yLabel: "Location" },
    });
    const items = wrapper.findComponent(ChartMenu).props("items");
    items.find((i) => i.label === "Download CSV")!.action();
    expect(spy.mock.calls[0][0]).toBe("Location,a,b,c\nAZ,0,0.5,1\nCA,1,NaN,0");
    spy.mockRestore();
    wrapper.unmount();
  });
});

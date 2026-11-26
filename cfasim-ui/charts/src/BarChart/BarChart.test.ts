import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import BarChart from "./BarChart.vue";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import * as download from "../ChartMenu/download.js";

type Wrapper = ReturnType<typeof mount>;
const baseProps = { width: 400, height: 200, menu: false };
const PLOT_LEFT = 50;
const PLOT_W = 540;

const bars = (wrapper: Wrapper) => wrapper.findAll('[data-testid="bar"]');
const centers = (wrapper: Wrapper) =>
  bars(wrapper).map(
    (bar) => Number(bar.attributes("x")) + Number(bar.attributes("width")) / 2,
  );

const findOverlay = (wrapper: Wrapper) =>
  wrapper.find('[data-testid="chart-overlay"]').exists()
    ? wrapper.find('[data-testid="chart-overlay"]')
    : wrapper
        .findAll("rect")
        .find((rect) => rect.attributes("fill") === "transparent")!;

const csvHref = (wrapper: Wrapper) =>
  decodeURIComponent(
    wrapper.find("a.bar-chart-download-link").attributes("href")!,
  )
    .split(",")
    .slice(1)
    .join(",");

function parsePathPoints(
  pathData: string,
): { cmd: "M" | "L"; x: number; y: number }[] {
  const points: { cmd: "M" | "L"; x: number; y: number }[] = [];
  const regex = /([ML])([-\d.]+),([-\d.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(pathData))) {
    points.push({
      cmd: match[1] as "M" | "L",
      x: parseFloat(match[2]),
      y: parseFloat(match[3]),
    });
  }
  return points;
}

describe("BarChart", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("layouts, baselines, and log scale", () => {
    it("renders grouped, stacked, overlay, and horizontal layouts with typed arrays and NaN skipping", () => {
      const grouped = mount(BarChart, {
        props: {
          ...baseProps,
          series: [{ data: new Float64Array([10, NaN]) }, { y: [20, 30] }],
          categories: ["A", "B"],
          groupGap: 10,
        },
      });
      const groupedBars = bars(grouped);
      expect(groupedBars).toHaveLength(3);
      expect(
        Number(groupedBars[1].attributes("x")) -
          (Number(groupedBars[0].attributes("x")) +
            Number(groupedBars[0].attributes("width"))),
      ).toBeCloseTo(10, 1);

      const overlay = mount(BarChart, {
        props: {
          ...baseProps,
          series: [{ data: [10] }, { data: [20] }],
          categories: ["A"],
          layout: "overlay",
        },
      });
      const stacked = mount(BarChart, {
        props: {
          ...baseProps,
          series: [{ data: [10] }, { data: [20] }],
          categories: ["A"],
          layout: "stacked",
        },
      });
      expect(bars(overlay)[0].attributes("x")).toBe(
        bars(overlay)[1].attributes("x"),
      );
      // Overlay scales to per-series max (20) rather than cumulative sum (30).
      const maxHeight = (wrapper: Wrapper) =>
        Math.max(
          ...bars(wrapper).map((bar) => Number(bar.attributes("height"))),
        );
      expect(maxHeight(overlay)).toBeGreaterThan(maxHeight(stacked));

      const horizontal = mount(BarChart, {
        props: { ...baseProps, data: [10, 20, 30], orientation: "horizontal" },
      });
      expect(
        new Set(bars(horizontal).map((bar) => bar.attributes("y"))).size,
      ).toBe(3);
    });

    it("handles negative, zero, valueMin/valueMax, stacked sign, and log baselines", () => {
      const signed = mount(BarChart, {
        props: { ...baseProps, data: [10, -10], categories: ["pos", "neg"] },
      });
      const [posBar, negBar] = bars(signed);
      expect(Number(posBar.attributes("height"))).toBeCloseTo(
        Number(negBar.attributes("height")),
        0,
      );
      expect(
        Number(posBar.attributes("y")) + Number(posBar.attributes("height")),
      ).toBeCloseTo(Number(negBar.attributes("y")), 1);

      const minChart = mount(BarChart, {
        props: { ...baseProps, data: [60, 90], valueMin: 50 },
      });
      const minHeights = bars(minChart).map((bar) =>
        Number(bar.attributes("height")),
      );
      expect(minHeights[1] / minHeights[0]).toBeCloseTo(4, 1);

      const tallest = (valueMax?: number) =>
        Number(
          bars(
            mount(BarChart, {
              props: { ...baseProps, data: [10, 20], valueMax },
            }),
          )[1].attributes("height"),
        );
      expect(tallest(40)).toBeCloseTo(tallest() / 2, 1);
      expect(tallest(5)).toBeCloseTo(tallest(), 1);

      const mixed = mount(BarChart, {
        props: {
          ...baseProps,
          series: [{ data: [3] }, { data: [-2] }],
          layout: "stacked",
        },
      });
      const [mixedPos, mixedNeg] = bars(mixed);
      expect(
        Number(mixedPos.attributes("y")) +
          Number(mixedPos.attributes("height")),
      ).toBeCloseTo(Number(mixedNeg.attributes("y")), 1);

      const allNegative = mount(BarChart, {
        props: {
          ...baseProps,
          series: [{ data: [-2] }, { data: [-3] }],
          layout: "stacked",
        },
      });
      const [firstNeg, secondNeg] = bars(allNegative);
      expect(
        Number(firstNeg.attributes("y")) +
          Number(firstNeg.attributes("height")),
      ).toBeCloseTo(Number(secondNeg.attributes("y")), 1);

      // Log scale: geometric heights and ignores valueMin <= 0.
      const logChart = mount(BarChart, {
        props: {
          ...baseProps,
          data: [1, 10, 100],
          valueScaleType: "log",
          valueMin: 0,
        },
      });
      expect(
        logChart
          .findAll('[data-testid="value-tick"]')
          .map((tick) => tick.text()),
      ).toEqual(["1", "10", "100"]);
      const logHeights = bars(logChart).map((bar) =>
        Number(bar.attributes("height")),
      );
      expect(logHeights[0]).toBe(0);
      expect(logHeights[1] / logHeights[2]).toBeCloseTo(0.5, 1);
    });
  });

  describe("continuous x-axis", () => {
    const continuousBase = { width: 600, height: 300, menu: false };

    it("positions numeric x gaps, uneven x2 bins, calendar periods, tooltip ranges, and CSV x_end", async () => {
      const gapped = mount(BarChart, {
        props: { ...continuousBase, data: [5, 6, 7], x: [0, 1, 3] },
      });
      const unit = PLOT_W / 4;
      expect(centers(gapped)[0]).toBeCloseTo(PLOT_LEFT + 0.5 * unit);
      expect(centers(gapped)[2]).toBeCloseTo(PLOT_LEFT + 3.5 * unit);
      expect(Number(bars(gapped)[0].attributes("width"))).toBeCloseTo(
        unit * 0.8,
      );

      const bins = mount(BarChart, {
        props: {
          ...continuousBase,
          data: [4, 8],
          x: [0, 1],
          x2: [1, 4],
          barPadding: 0,
        },
      });
      const [firstWidth, secondWidth] = bars(bins).map((rect) =>
        Number(rect.attributes("width")),
      );
      expect(secondWidth / firstWidth).toBeCloseTo(3);

      const weekly = mount(BarChart, {
        props: {
          ...continuousBase,
          data: [3, 4, 5],
          x: ["2026-01-05", "2026-01-12", "2026-01-26"],
          period: "week",
          barPadding: 0,
          downloadLink: true,
          tooltipTrigger: "hover",
        },
        attachTo: document.body,
      });
      const rects = bars(weekly);
      for (const rect of rects)
        expect(Number(rect.attributes("width"))).toBeCloseTo(PLOT_W / 4);
      expect(Number(rects[2].attributes("x"))).toBeCloseTo(
        PLOT_LEFT + (3 * PLOT_W) / 4,
      );
      expect(csvHref(weekly)).toBe(
        "x,x_end,value\n2026-01-05,2026-01-12,3\n2026-01-12,2026-01-19,4\n2026-01-26,2026-02-02,5",
      );
      await findOverlay(weekly).trigger("mousemove", {
        clientX: PLOT_LEFT + PLOT_W / 8,
        clientY: 100,
      });
      expect(weekly.find(".chart-tooltip-label").text()).toBe(
        "2026-01-05 – 2026-01-11",
      );
      weekly.unmount();
    });

    it("shares slots across series, lays out horizontally, zooms continuous ranges, and warns on invalid mixes", async () => {
      const grouped = mount(BarChart, {
        props: {
          ...continuousBase,
          series: [
            { data: [1, 2, 3], x: [0, 1, 2] },
            { data: [4, 5], x: [1, 2] },
          ],
        },
      });
      expect(
        bars(grouped).map((bar) => bar.attributes("data-category")),
      ).toEqual(["0", "1", "1", "2", "2"]);

      const horizontal = mount(BarChart, {
        props: {
          ...continuousBase,
          data: [1, 2, 3],
          x: [0, 1, 3],
          orientation: "horizontal",
        },
      });
      const centerYs = bars(horizontal).map(
        (rect) =>
          Number(rect.attributes("y")) + Number(rect.attributes("height")) / 2,
      );
      expect(centerYs[2] - centerYs[1]).toBeCloseTo(
        2 * (centerYs[1] - centerYs[0]),
      );

      const zoomChart = mount(BarChart, {
        props: {
          ...continuousBase,
          data: Array.from({ length: 10 }, (_, index) => index + 1),
          x: Array.from({ length: 10 }, (_, index) => index),
          zoom: true,
        },
      });
      const slotWidth = PLOT_W / 10;
      await findOverlay(zoomChart).trigger("pointerdown", {
        clientX: PLOT_LEFT + 2 * slotWidth,
        button: 0,
      });
      const target = { clientX: PLOT_LEFT + 5 * slotWidth };
      window.dispatchEvent(new MouseEvent("pointermove", target));
      window.dispatchEvent(new MouseEvent("pointerup", target));
      await nextTick();
      expect(
        bars(zoomChart).map((bar) => bar.attributes("data-category")),
      ).toEqual(["2", "3", "4"]);
      await zoomChart.find('[aria-label="Reset zoom"]').trigger("click");
      expect(bars(zoomChart)).toHaveLength(10);

      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const badCategories = mount(BarChart, {
        props: {
          ...continuousBase,
          data: [1, 2],
          x: [0, 1],
          categories: ["a", "b"],
        },
      });
      expect(
        badCategories
          .findAll('[data-testid="category-tick"]')
          .map((tick) => tick.text()),
      ).not.toContain("a");
      const missingX = mount(BarChart, {
        props: {
          ...continuousBase,
          series: [
            { data: [1, 2], x: ["2026-01-05", "2026-01-12"] },
            { data: [3, 4] },
          ],
        },
      });
      expect(bars(missingX)).toHaveLength(2);
      expect(warn).toHaveBeenCalledTimes(2);
    });
  });

  describe("axes, horizontal label room, and barLabels", () => {
    it("formats ticks, auto-detects date categories, and thins crowded labels", () => {
      const formatted = mount(BarChart, {
        props: {
          ...baseProps,
          data: [0, 50, 100],
          categories: ["a", "b", "c"],
          valueTicks: [0, 50, 100],
          valueTickFormat: (value: number) => `${value}%`,
          categoryFormat: (label: string) => label.toUpperCase(),
        },
      });
      expect(
        formatted
          .findAll('[data-testid="value-tick"]')
          .map((tick) => tick.text()),
      ).toEqual(["0%", "50%", "100%"]);
      expect(
        formatted
          .findAll('[data-testid="category-tick"]')
          .map((tick) => tick.text()),
      ).toEqual(["A", "B", "C"]);

      const dateCategories = Array.from({ length: 12 }, (_, index) =>
        new Date(Date.UTC(2026, 0, 1 + index * 7)).toISOString().slice(0, 10),
      );
      const dated = mount(BarChart, {
        props: {
          ...baseProps,
          data: dateCategories.map((_, index) => index),
          categories: dateCategories,
        },
      });
      const dateLabels = dated
        .findAll('[data-testid="category-tick"]')
        .map((tick) => tick.text());
      expect(dateLabels.join(" ")).toMatch(/Jan|Feb|Mar/);
      expect(dateLabels.length).toBeLessThan(dateCategories.length);

      const crowded = Array.from({ length: 14 }, (_, index) =>
        (2 + index * 0.22).toFixed(2),
      );
      const thinned = mount(BarChart, {
        props: {
          data: crowded.map((_, index) => index),
          categories: crowded,
          width: 320,
          height: 200,
          menu: false,
        },
      });
      const kept = thinned
        .findAll('[data-testid="category-tick"]')
        .map((tick) => tick.text());
      expect(kept.length).toBeLessThan(crowded.length);
      for (const label of kept) expect(crowded).toContain(label);
    });

    it("sizes horizontal category padding, clears yLabel, and truncates past 40% width with title", () => {
      const longLabel = "A much longer category label";
      const longWidth = longLabel.length * 6;
      const mountHorizontal = (extra: Record<string, unknown>) =>
        mount(BarChart, {
          props: {
            data: [10, 20],
            categories: ["Short", longLabel],
            orientation: "horizontal",
            width: 600,
            height: 200,
            menu: false,
            ...extra,
          },
        });
      const rightEdge = (wrapper: Wrapper) =>
        Number(wrapper.find('[data-testid="category-tick"]').attributes("x"));

      const fit = mountHorizontal({});
      expect(rightEdge(fit) - longWidth).toBeGreaterThanOrEqual(0);
      expect(Number(bars(fit)[0].attributes("x"))).toBe(rightEdge(fit) + 6);
      expect(
        rightEdge(mountHorizontal({ yLabel: "Setting" })) - longWidth,
      ).toBe(22);
      expect(rightEdge(mountHorizontal({ chartPadding: { left: 150 } }))).toBe(
        50 + 150 - 6,
      );

      const narrow = mountHorizontal({ width: 300 });
      expect(rightEdge(narrow)).toBe(2 + 300 * 0.4);
      const ticks = narrow.findAll('[data-testid="category-tick"]');
      expect(ticks[1].find("title").text()).toBe(longLabel);
      const drawn = ticks[1].element.firstChild?.textContent?.trim() ?? "";
      expect(drawn.endsWith("…")).toBe(true);
      expect(drawn.length * 6).toBeLessThanOrEqual(300 * 0.4);
    });

    it("places barLabels with contrast fill, outside overflow, and overlap hiding", () => {
      const overflow = mount(BarChart, {
        props: {
          series: [
            { data: [1], color: "#2a1a4a" },
            { data: [99], color: "#e8d9f5" },
          ],
          categories: ["a"],
          orientation: "horizontal",
          layout: "stacked",
          width: 500,
          height: 120,
          menu: false,
          barLabels: true,
        },
      });
      const labels = overflow.findAll('[data-testid="bar-label"]');
      const tiny = labels.find((node) => node.text() === "1")!;
      expect(tiny.attributes("text-anchor")).toBe("start");
      expect(tiny.attributes("fill")).toBe("#1a1a1a");
      expect(
        labels.find((node) => node.text() === "99")!.attributes("text-anchor"),
      ).toBe("middle");

      const hidden = mount(BarChart, {
        props: {
          series: Array.from({ length: 8 }, () => ({ data: [1] })),
          categories: ["a"],
          orientation: "horizontal",
          layout: "stacked",
          width: 120,
          height: 80,
          menu: false,
          barLabels: { overlap: "hide" },
        },
      });
      expect(hidden.findAll('[data-testid="bar-label"]').length).toBeLessThan(
        8,
      );
    });
  });

  describe("interactions, tooltips, and downloads", () => {
    beforeEach(() => vi.restoreAllMocks());

    it("handles hover/click modes, touch-action per orientation, tooltip formatting, and range-only NaN rows", async () => {
      const hoverChart = mount(BarChart, {
        props: {
          ...baseProps,
          series: [
            { data: [10, 20], legend: "2024" },
            { data: [15, 25], tooltipLabel: "2025" },
            { data: [5, 7], showInTooltip: false },
          ],
          categories: ["A", "B"],
          intervals: [{ x: 0, lower: 5, upper: 12, label: "Target" }],
          tooltipTrigger: "hover",
          tooltipTitle: (label: string) => `Region ${label}`,
        },
        attachTo: document.body,
      });
      const overlay = findOverlay(hoverChart);
      expect(overlay.attributes("style")).toContain("touch-action: pan-y");
      await overlay.trigger("mousemove", { clientX: 100, clientY: 100 });
      expect(hoverChart.find(".chart-tooltip-label").text()).toBe("Region A");
      expect(
        hoverChart.findAll(".chart-tooltip-row").map((row) => row.text()),
      ).toEqual(["202410", "202515", "Target5–12"]);
      await overlay.trigger("mouseleave");
      expect(hoverChart.emitted("hover")!.at(-1)![0]).toBeNull();
      hoverChart.unmount();

      const clickChart = mount(BarChart, {
        props: {
          ...baseProps,
          data: [1, 2, 3],
          categories: ["A", "B", "C"],
          orientation: "horizontal",
          tooltipTrigger: "click",
        },
        attachTo: document.body,
      });
      const clickOverlay = findOverlay(clickChart);
      expect(clickOverlay.attributes("style")).toContain("touch-action: pan-x");
      await clickOverlay.trigger("click", { clientX: 100, clientY: 40 });
      const countBeforeLeave = clickChart.emitted("hover")!.length;
      await clickOverlay.trigger("mouseleave");
      expect(clickChart.emitted("hover")!.length).toBe(countBeforeLeave);
      await clickOverlay.trigger("click", { clientX: 100, clientY: 40 });
      expect(clickChart.emitted("hover")!.at(-1)![0]).toBeNull();
      clickChart.unmount();

      const rangeOnly = mount(BarChart, {
        props: {
          ...baseProps,
          series: [{ data: [NaN, 20], lower: [3, 15], upper: [9, 25] }],
          categories: ["A", "B"],
          tooltipTrigger: "hover",
        },
        attachTo: document.body,
      });
      await findOverlay(rangeOnly).trigger("mousemove", {
        clientX: 100,
        clientY: 100,
      });
      expect(
        rangeOnly.find(".chart-tooltip-row").text().replace(/\s+/g, " "),
      ).toBe("— (3–9)");
      rangeOnly.unmount();
    });

    it("wires CSV and SVG downloads through menu and downloadButton", () => {
      const csvSpy = vi
        .spyOn(download, "downloadCsv")
        .mockImplementation(() => {});
      const svgSpy = vi.spyOn(download, "saveSvg").mockImplementation(() => {});
      const wrapper = mount(BarChart, {
        props: {
          series: [
            { data: [1, 2], legend: "low" },
            { data: [3, 4], legend: "high" },
          ],
          categories: ["A", "B"],
          width: 400,
          height: 200,
          filename: "my-bars",
        },
      });
      const items = wrapper.findComponent(ChartMenu).props("items");
      items.find((item) => item.label === "Download CSV")!.action();
      expect(csvSpy).toHaveBeenCalledWith(
        "category,low,high\nA,1,3\nB,2,4",
        "my-bars",
      );
      items.find((item) => item.label === "Save SVG")!.action();
      expect(svgSpy).toHaveBeenCalledWith(expect.anything(), "my-bars");

      const buttonChart = mount(BarChart, {
        props: {
          data: [1, 2],
          categories: ["A", "B"],
          width: 400,
          height: 200,
          downloadButton: "Export",
          downloadLink: true,
          csv: () => "fn,csv\nA,B",
        },
      });
      expect(buttonChart.find("a.bar-chart-download-link").exists()).toBe(
        false,
      );
      buttonChart.find("button.bar-chart-download-button").trigger("click");
      expect(csvSpy).toHaveBeenLastCalledWith("fn,csv\nA,B", "chart");
    });
  });

  describe("summary lines, annotations, intervals, zoom, and legend", () => {
    it("plots shared/step-after/NaN-gapped summary lines and vertical/horizontal annotations", async () => {
      const shared = mount(BarChart, {
        props: {
          ...baseProps,
          data: [10, 20, 30],
          categories: ["a", "b", "c"],
          summaryLines: [
            {
              data: [20, 50, 20],
              scale: "shared",
              legend: "T",
              curve: "step-after",
            },
          ],
          annotations: [
            { x: 1, y: 20, offset: { x: 0, y: -10 }, text: "Peak" },
          ],
        },
      });
      const barTop = (index: number) =>
        Number(bars(shared)[index].attributes("y"));
      const points = parsePathPoints(
        shared.find('[data-testid="summary-line"]').attributes("d") ?? "",
      );
      expect(points).toHaveLength(5);
      expect(points[0].y).toBeCloseTo(barTop(1));
      expect(points[2].y).toBeLessThan(barTop(2));
      const expectedX =
        Number(bars(shared)[1].attributes("x")) +
        Number(bars(shared)[1].attributes("width")) / 2;
      expect(
        Number(shared.find("g.chart-annotations text").attributes("x")),
      ).toBeCloseTo(expectedX, 0);
      const topWithLine = barTop(2);
      await shared.setProps({ hiddenSeries: ["T"] });
      expect(barTop(2)).toBeLessThan(topWithLine);

      const gapped = mount(BarChart, {
        props: {
          ...baseProps,
          data: [10, 20, 30, 40],
          summaryLines: [
            { data: [1, NaN, 3, 4], dots: true, dotRadius: [2, 9, 4, 5] },
          ],
        },
      });
      expect(
        parsePathPoints(
          gapped.find('[data-testid="summary-line"]').attributes("d") ?? "",
        ).map((point) => point.cmd),
      ).toEqual(["M", "M", "L"]);
      expect(
        gapped.findAll("circle").map((circle) => circle.attributes("r")),
      ).toEqual(["2", "4", "5"]);
    });

    it("renders grouped, standalone, and horizontal intervals and includes bounds in tooltip/CSV", async () => {
      const wrapper = mount(BarChart, {
        props: {
          ...baseProps,
          series: [
            { data: [10, 20], lower: [8, 18], upper: [12, 22], legend: "A" },
            { data: [15, 25], legend: "B" },
          ],
          intervals: [
            { x: 1, lower: 10, upper: 100, seriesIndex: 0 },
            { x: 9, lower: 1, upper: 2 },
          ],
          categories: ["x", "y"],
          downloadLink: true,
          tooltipTrigger: "hover",
        },
        slots: {
          tooltip: `<template #tooltip="p"><div class="tt">{{ p.values[0].lower }}-{{ p.values[0].upper }}|{{ p.intervals.map(i => i.lower + '-' + i.upper).join() }}</div></template>`,
        },
      });
      const items = wrapper.findAll('[data-testid="interval"]');
      expect(items).toHaveLength(3);
      const firstBar = bars(wrapper)[0];
      expect(
        Number(items[0].find("line.interval-line").attributes("x1")),
      ).toBeCloseTo(
        Number(firstBar.attributes("x")) +
          Number(firstBar.attributes("width")) / 2,
        5,
      );
      expect(wrapper.findAll("text").map((text) => text.text())).toContain(
        "100",
      );
      await findOverlay(wrapper).trigger("mousemove", {
        clientX: 300,
        clientY: 100,
      });
      expect(wrapper.find(".tt").text()).toBe("18-22|10-100");
      expect(csvHref(wrapper)).toBe(
        "category,A,A_lower,A_upper,B\nx,10,8,12,15\ny,20,18,22,25",
      );
      await wrapper.setProps({ hiddenSeries: ["A"] });
      expect(wrapper.findAll('[data-testid="interval"]')).toHaveLength(0);

      const horizontal = mount(BarChart, {
        props: {
          ...baseProps,
          data: [10, 20],
          intervals: [{ x: 0, lower: 5, upper: 15 }],
          orientation: "horizontal",
        },
      });
      const horizontalLine = horizontal.find(
        '[data-testid="interval"] line.interval-line',
      );
      expect(horizontalLine.attributes("y1")).toBe(
        horizontalLine.attributes("y2"),
      );
      expect(Number(horizontalLine.attributes("x2"))).toBeGreaterThan(
        Number(horizontalLine.attributes("x1")),
      );
    });

    it("supports box/horizontal brush zoom with summary-line alignment and legend toggle/highlight", async () => {
      const zoomProps = {
        data: [1, 2, 3, 4, 50, 6, 7, 8, 9, 10],
        width: 600,
        height: 300,
        menu: false,
        zoom: true,
      };
      const brush = async (
        wrapper: Wrapper,
        from: { clientX?: number; clientY?: number },
        to: { clientX?: number; clientY?: number },
      ) => {
        await findOverlay(wrapper).trigger("pointerdown", {
          ...from,
          button: 0,
        });
        window.dispatchEvent(new MouseEvent("pointermove", to));
        window.dispatchEvent(new MouseEvent("pointerup", to));
        await nextTick();
      };

      const wrapper = mount(BarChart, {
        props: {
          ...zoomProps,
          summaryLines: [{ data: Array(10).fill(0.25), valueMax: 1 }],
        },
      });
      const top = Number(findOverlay(wrapper).attributes("y"));
      const height = Number(findOverlay(wrapper).attributes("height"));
      await brush(
        wrapper,
        { clientX: 50 + 54 * 3.5, clientY: top + height / 2 },
        { clientX: 50 + 54 * 5.5, clientY: top + height },
      );
      expect(
        bars(wrapper).map((bar) => bar.attributes("data-category")),
      ).toEqual(["3", "4", "5"]);
      expect(
        Math.max(
          ...wrapper
            .findAll('[data-testid="value-tick"]')
            .map((tick) => Number(tick.text())),
        ),
      ).toBeLessThanOrEqual(25);
      const lineY = Number(
        wrapper
          .find('[data-testid="summary-line"]')
          .attributes("d")!
          .match(/^M[^,]+,([^L]+)/)![1],
      );
      expect(lineY).toBeCloseTo(top + height * 0.5);
      await wrapper.find('[aria-label="Reset zoom"]').trigger("click");
      expect(bars(wrapper)).toHaveLength(10);

      const horizontal = mount(BarChart, {
        props: { ...zoomProps, orientation: "horizontal" },
      });
      const firstY = Number(bars(horizontal)[0].attributes("y"));
      const slot = Number(bars(horizontal)[1].attributes("y")) - firstY;
      await brush(
        horizontal,
        { clientY: firstY + slot * 2 },
        { clientY: firstY + slot * 4 },
      );
      expect(
        bars(horizontal).map((bar) => bar.attributes("data-category")),
      ).toEqual(["2", "3", "4"]);
      await findOverlay(horizontal).trigger("dblclick");
      expect(bars(horizontal)).toHaveLength(10);

      const legendChart = mount(BarChart, {
        props: {
          series: [
            { data: [1, 2], legend: "Low" },
            { data: [100, 200], legend: "High" },
          ],
          summaryLines: [{ data: [1, 2], legend: "Trend" }],
          categories: ["A", "B"],
          width: 600,
          height: 300,
          menu: false,
          legendToggle: true,
        },
      });
      const widthBefore = Number(bars(legendChart)[0].attributes("width"));
      const highFill = bars(legendChart)
        .find((bar) => bar.attributes("data-series") === "1")!
        .attributes("fill");
      const toggles = legendChart.findAll(".chart-legend-toggle");
      await toggles[0].trigger("click");
      expect(bars(legendChart)).toHaveLength(2);
      expect(bars(legendChart)[0].attributes("fill")).toBe(highFill);
      expect(Number(bars(legendChart)[0].attributes("width"))).toBeGreaterThan(
        widthBefore,
      );
      await toggles[2].trigger("click");
      expect(legendChart.find('[data-testid="summary-line"]').exists()).toBe(
        false,
      );

      const highlightChart = mount(BarChart, {
        props: {
          ...baseProps,
          series: [
            { data: [1, 2], legend: "A" },
            { data: [3, 4], legend: "B" },
          ],
          legendHighlight: true,
        },
      });
      highlightChart
        .findAll("rect.legend-hit")[1]
        .element.parentElement!.dispatchEvent(new MouseEvent("mouseenter"));
      await nextTick();
      expect(
        highlightChart
          .findAll('[data-testid="bar"][data-series="0"]')
          .map((bar) => bar.attributes("opacity")),
      ).toEqual(["0.15", "0.15"]);
      expect(highlightChart.emitted("legendHover")).toEqual([["B"]]);
    });
  });
});

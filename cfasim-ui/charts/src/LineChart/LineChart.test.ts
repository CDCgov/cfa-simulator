import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import LineChart from "./LineChart.vue";
import type { AreaSection } from "./LineChart.vue";
import { stackAreas } from "./stackAreas.js";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import * as download from "../ChartMenu/download.js";
import { CHART_MENU_ITEM_KEYS } from "../_shared/chartProps.js";

type Wrapper = ReturnType<typeof mount>;
const baseProps = { width: 400, height: 200, menu: false };

const findOverlay = (wrapper: Wrapper) =>
  wrapper.find('[data-testid="chart-overlay"]').exists()
    ? wrapper.find('[data-testid="chart-overlay"]')
    : wrapper
        .findAll("rect")
        .find((rect) => rect.attributes("fill") === "transparent")!;

const tickTexts = (wrapper: Wrapper, id: "x-tick" | "y-tick") =>
  wrapper.findAll(`[data-testid="${id}"]`).map((tick) => tick.text());

const tickNumbers = (wrapper: Wrapper, id: "x-tick" | "y-tick") =>
  tickTexts(wrapper, id).map((text) => Number(text.replace(/,/g, "")));

const menuItem = (wrapper: Wrapper, label: string) =>
  wrapper
    .findComponent(ChartMenu)
    .props("items")
    .find((item) => item.label === label)!;

describe("LineChart", () => {
  it("renders typed arrays, NaN gaps, line:false, and per-point dot styles", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(LineChart, {
      props: {
        ...baseProps,
        series: [
          {
            data: new Float64Array([0, NaN, 20]),
            dots: true,
            dotRadius: [2, 9, 4],
            dotFill: ["red", "green", "blue"],
            dotOpacity: new Float64Array([0.5, 1, NaN]),
          },
          {
            y: new Int32Array([5, 30]),
            color: "purple",
            line: false,
            dots: true,
            dotFill: (point) =>
              point.value > 10
                ? "orange"
                : `${point.color}/${point.seriesIndex}`,
            dotRadius: (point) => (point.index === 0 ? undefined : 7),
          },
        ],
      },
    });
    expect(
      warn.mock.calls.filter((call) =>
        String(call[0] ?? "").includes("[Vue warn]"),
      ),
    ).toEqual([]);
    warn.mockRestore();

    const linePaths = wrapper
      .findAll("path")
      .filter((path) => path.attributes("fill") === "none");
    expect(linePaths).toHaveLength(1);
    expect((linePaths[0].attributes("d")!.match(/M/g) ?? []).length).toBe(2);

    // Skipped NaN point does not shift subsequent per-point styles.
    expect(
      wrapper
        .findAll("circle")
        .map((circle) => [
          circle.attributes("r"),
          circle.attributes("fill"),
          circle.attributes("fill-opacity"),
        ]),
    ).toEqual([
      ["2", "red", "0.5"],
      ["4", "blue", "1"],
      ["2.5", "purple/1", "1"],
      ["7", "orange", "1"],
    ]);
  });

  it("applies chart-level and per-series curves to lines, areas, and sections", () => {
    const commands = (pathData: string) => pathData.replace(/[^MLCZ]/g, "");
    const wrapper = mount(LineChart, {
      props: {
        ...baseProps,
        curve: "monotone",
        series: [
          { data: [0, 10, 5] },
          { data: [1, 2, 3], curve: "step-after" },
        ],
        areas: [{ upper: [2, 12, 7], lower: [0, 8, 3] }],
      },
    });
    expect(
      wrapper
        .findAll('path[fill="none"]:not([data-testid])')
        .map((path) => commands(path.attributes("d")!)),
    ).toEqual(["MCC", "MLLLL"]);
    expect(commands(wrapper.find('path[stroke="none"]').attributes("d")!)).toBe(
      "MCCLCCZ",
    );

    const curved = mount(LineChart, {
      props: {
        ...baseProps,
        series: [{ data: [0, 4, 1, 6, 3, 8, 2, 5], curve: "monotone" }],
        areaSections: [{ seriesIndex: 0, startIndex: 2, endIndex: 5 }],
      },
    });
    const paths = curved
      .findAll('path[fill="none"]')
      .map((path) => path.attributes("d")!);
    const fullPath = paths.find(
      (pathData) => (pathData.match(/C/g) ?? []).length === 7,
    )!;
    const sectionPath = paths.find(
      (pathData) => (pathData.match(/C/g) ?? []).length === 3,
    )!;
    expect(sectionPath.split("C").slice(1)).toEqual(
      fullPath.split("C").slice(1).slice(2, 5),
    );

    const gapped = mount(LineChart, {
      props: {
        ...baseProps,
        series: [{ data: [1, NaN, 3, 4, NaN, 6, 7] }],
        areaSections: [{ seriesIndex: 0, startIndex: 1, endIndex: 6 }],
      },
    });
    const fillPath = gapped
      .find('[data-testid="section-fill"]')
      .attributes("d")!;
    expect(fillPath).not.toContain("NaN");
    expect(fillPath.match(/Z/g)).toHaveLength(2);
  });

  describe("axes, scales, and dates", () => {
    it("plots explicit x, honors xMin/xMax without clipping, anchors edge ticks, and breaks on NaN x", () => {
      const positioned = mount(LineChart, {
        props: {
          x: [0, 1, 10],
          y: [0, 5, 10],
          width: 410,
          height: 100,
          menu: false,
        },
      });
      const pathData = positioned.findAll("path").at(-1)!.attributes("d") ?? "";
      expect(pathData).toMatch(/^M50,/);
      expect(pathData).toMatch(/L85,/);
      expect(pathData).toMatch(/L400,/);

      const bounded = mount(LineChart, {
        props: {
          ...baseProps,
          x: [10, 20, 30],
          y: [2, 5, 8],
          xMin: 0,
          xMax: 50,
          yMin: 0,
          yMax: 20,
          xTicks: [0, 10, 30, 50, 99],
          yTicks: [0, 10, 20],
          xTickFormat: (value: number) => `d${value}`,
          yTickFormat: (value: number) => `${value}%`,
        },
      });
      expect(tickTexts(bounded, "x-tick")).toEqual(["d0", "d10", "d30", "d50"]);
      expect(tickTexts(bounded, "y-tick")).toEqual(["0%", "10%", "20%"]);
      expect(
        bounded
          .findAll('[data-testid="x-tick"]')
          .map((tick) => tick.attributes("text-anchor")),
      ).toEqual(["start", "middle", "middle", "end"]);

      const inside = mount(LineChart, {
        props: {
          ...baseProps,
          x: [10, 20, 30],
          y: [2, 5, 8],
          xMin: 15,
          xMax: 20,
          yMax: 4,
          xTicks: [0, 10, 30, 50],
        },
      });
      expect(tickTexts(inside, "x-tick")).toEqual(["10", "30"]);
      expect(Math.max(...tickNumbers(inside, "y-tick"))).toBeGreaterThanOrEqual(
        8,
      );

      const nanChart = mount(LineChart, {
        props: { ...baseProps, x: [0, NaN, 10], y: [0, 5, 10] },
      });
      expect(
        (nanChart.findAll("path").at(-1)!.attributes("d")!.match(/M/g) ?? [])
          .length,
      ).toBeGreaterThanOrEqual(2);
    });

    it("supports log y-scale with geometric midpoint and ignores yMin <= 0", () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          data: [1, 10, 100, 1000],
          yScaleType: "log",
          yMin: 0,
        },
      });
      expect(tickTexts(wrapper, "y-tick")).toEqual(["1", "10", "100", "1,000"]);
      const pathData = wrapper.findAll("path").at(-1)!.attributes("d") ?? "";
      expect(pathData).toBeTruthy();
      expect(pathData).not.toMatch(/NaN|Infinity/);

      const midpointChart = mount(LineChart, {
        props: { ...baseProps, data: [1, 10, 100], yScaleType: "log" },
      });
      const tickYs = midpointChart
        .findAll('[data-testid="y-tick"]')
        .map((tick) => Number(tick.attributes("y")));
      expect(tickYs[1]).toBeCloseTo((tickYs[0] + tickYs[2]) / 2, 0);
    });

    it("auto-detects date axes, honors timezone, renders date tooltips, and handles empty range", async () => {
      const autoDate = mount(LineChart, {
        props: {
          data: [10, 20, 30, 40],
          x: ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"],
          width: 600,
          height: 200,
          menu: false,
          tooltipTrigger: "hover",
        },
        attachTo: document.body,
      });
      const labels = tickTexts(autoDate, "x-tick");
      expect(labels.join(" ")).toMatch(/Jan|Feb|Mar|Apr/);
      for (const label of labels) expect(label).not.toMatch(/\d{10,}/);
      await findOverlay(autoDate).trigger("mousemove", {
        clientX: 60,
        clientY: 100,
      });
      expect(autoDate.find(".chart-tooltip-label").text()).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
      autoDate.unmount();

      const utcChart = mount(LineChart, {
        props: {
          ...baseProps,
          data: [10, 20],
          x: ["2026-01-15", "2026-02-15"],
          xTickFormat: "iso-datetime",
          timezone: "utc",
          xTicks: [Date.UTC(2026, 0, 15), Date.UTC(2026, 1, 15)],
        },
      });
      const localChart = mount(LineChart, {
        props: {
          ...baseProps,
          data: [10, 20],
          x: ["2026-01-15", "2026-02-15"],
          xTickFormat: "iso-datetime",
          timezone: "local",
          xTicks: [
            new Date(2026, 0, 15).getTime(),
            new Date(2026, 1, 15).getTime(),
          ],
        },
      });
      expect(
        tickTexts(utcChart, "x-tick").every((label) => label.endsWith("Z")),
      ).toBe(true);
      expect(
        tickTexts(localChart, "x-tick").every((label) => !label.endsWith("Z")),
      ).toBe(true);

      const emptyChart = mount(LineChart, {
        props: {
          ...baseProps,
          series: [{ x: [], y: [] }],
          xMin: "2026-01-01",
          xMax: "2026-03-01",
          xTicks: [Date.UTC(2026, 0, 1), Date.UTC(2026, 1, 1)],
          xTickFormat: "iso",
        },
      });
      expect(tickTexts(emptyChart, "x-tick")).toEqual([
        "2026-01-01",
        "2026-02-01",
      ]);
    });
  });

  describe("tooltip, stacked areas, and color scale", () => {
    it("positions tooltip on first mousemove, emits hover/null, and formats rows/areas/stacks", async () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          series: [
            { data: [1, 2, 3], legend: "Median", color: "#0057b7" },
            { data: [1, NaN, 3], legend: "Missing" },
            { data: [4, 5, 6], legend: "Hidden", showInTooltip: false },
            { data: [2, 3, 4] },
          ],
          areas: [
            { lower: [0, 1, 2], upper: [2, 4, 6], tooltipLabel: "95% CI" },
          ],
          tooltipData: new Float64Array([0.1, 0.2, 0.3]),
          tooltipTitle: (label: string, index: number) =>
            `Day ${label} (#${index})`,
          tooltipTrigger: "hover",
        },
        attachTo: document.body,
      });
      const overlay = findOverlay(wrapper);
      expect(overlay.attributes("style")).toContain("touch-action: pan-y");
      await overlay.trigger("mousemove", { clientX: 200, clientY: 50 });
      await nextTick();
      await nextTick();

      const tooltip = document.querySelector(
        ".chart-tooltip-content",
      ) as HTMLElement;
      expect(tooltip.style.transform).toContain("translate3d");
      expect(tooltip.style.visibility).toBe("visible");
      expect(wrapper.find(".chart-tooltip-label").text()).toBe("Day 1 (#1)");
      expect(
        wrapper.findAll(".chart-tooltip-row").map((row) => row.text()),
      ).toEqual(["Median2", "95% CI1–4"]);
      expect(wrapper.findAll("text").map((text) => text.text())).not.toContain(
        "95% CI",
      );

      await overlay.trigger("mouseleave");
      expect(wrapper.emitted("hover")!.at(-1)![0]).toBeNull();
      wrapper.unmount();

      // Stacked layers report their own value rather than cumulative band.
      const stacked = mount(LineChart, {
        props: {
          ...baseProps,
          areas: stackAreas([
            { y: [1, 2, 3], legend: "A" },
            { y: [4, 5, 6], legend: "B" },
          ]),
          tooltipTrigger: "hover",
        },
        attachTo: document.body,
      });
      await findOverlay(stacked).trigger("mousemove", {
        clientX: 200,
        clientY: 50,
      });
      expect(
        stacked.findAll(".chart-tooltip-row").map((row) => row.text()),
      ).toEqual(["A2", "B5"]);
      stacked.unmount();
    });

    it("anchors tooltip to union of x values and renders colorScale gradient, legend, and tooltip value", async () => {
      const unionChart = mount(LineChart, {
        props: {
          ...baseProps,
          series: [
            { x: [0, 10, 20], data: [1, 2, 3], legend: "A" },
            { x: [5, 15, 25], data: [4, 5, 6], legend: "B" },
          ],
          tooltipTrigger: "hover",
        },
        attachTo: document.body,
      });
      const labels = new Set<string>();
      for (let clientX = 0; clientX <= 400; clientX += 8) {
        await findOverlay(unionChart).trigger("mousemove", {
          clientX,
          clientY: 50,
        });
        labels.add(unionChart.find(".chart-tooltip-label").text());
      }
      expect([...labels]).toEqual(["0", "5", "10", "15", "20", "25"]);
      unionChart.unmount();

      const scaled = mount(LineChart, {
        props: {
          ...baseProps,
          series: [
            {
              data: [1, 2, 3],
              legend: "Cases",
              colorValue: [0, 5, 10],
              dots: true,
              dotFill: (point) => (point.index === 2 ? "red" : undefined),
            },
          ],
          colorScale: { label: "R₀", range: ["#000000", "#ffffff"] },
          tooltipTrigger: "hover",
        },
        attachTo: document.body,
      });
      const line = scaled
        .findAll("path")
        .find((path) => path.attributes("stroke")?.startsWith("url(#"))!;
      const gradientId = line.attributes("stroke")!.slice(5, -1);
      const stops = scaled
        .findAll(`linearGradient[id="${gradientId}"] stop`)
        .map((stop) => [
          stop.attributes("offset"),
          stop.attributes("stop-color"),
        ]);
      expect(stops[0]).toEqual(["0", "#000000"]);
      expect(stops[2]).toEqual(["1", "#ffffff"]);
      const dotFills = scaled
        .findAll('circle:not([data-testid="legend-dot"])')
        .map((circle) => circle.attributes("fill"));
      expect(dotFills[0]).toBe("#000000");
      expect(dotFills[2]).toBe("red");
      expect(
        scaled
          .get('[data-testid="legend-color-scale"]')
          .findAll("text")
          .map((text) => text.text()),
      ).toEqual(["R₀", "0", "10"]);
      await findOverlay(scaled).trigger("mousemove", {
        clientX: 200,
        clientY: 50,
      });
      expect(scaled.find(".chart-tooltip-color-value").text()).toBe("· R₀ 5");
      scaled.unmount();
    });
  });

  describe("menu downloads, clipboard, and fullscreen", () => {
    beforeEach(() => vi.restoreAllMocks());

    it("wires CSV/SVG downloads, clipboard live region, and menuItems ordering", async () => {
      const csvSpy = vi
        .spyOn(download, "downloadCsv")
        .mockImplementation(() => {});
      const svgSpy = vi.spyOn(download, "saveSvg").mockImplementation(() => {});
      const copySpy = vi.spyOn(download, "copySvg").mockResolvedValue();

      const wrapper = mount(LineChart, {
        props: {
          series: [
            { data: new Float64Array([1, 2]), legend: "A" },
            { data: [3, 4], legend: "B" },
          ],
          height: 100,
          menu: "legacy",
          filename: "preferred",
        },
      });
      await nextTick();
      expect(wrapper.findComponent(ChartMenu).props("items")).toHaveLength(
        CHART_MENU_ITEM_KEYS.length,
      );
      menuItem(wrapper, "Download CSV").action();
      expect(csvSpy).toHaveBeenCalledWith(
        "index,A,B\n0,1,3\n1,2,4",
        "preferred",
      );
      menuItem(wrapper, "Save SVG").action();
      expect(svgSpy).toHaveBeenCalledWith(expect.anything(), "preferred");
      menuItem(wrapper, "Copy SVG").action();
      expect(copySpy).toHaveBeenCalled();
      await vi.waitFor(() =>
        expect(wrapper.find(".chart-sr-only").text()).toBe(
          "Chart SVG copied to clipboard",
        ),
      );

      const buttonChart = mount(LineChart, {
        props: {
          x: [0, 2.5],
          y: [1, 2],
          height: 100,
          downloadButton: "Export",
          downloadLink: true,
          csv: () => "custom,csv\n1,2",
          menuItems: ["csv", "save-svg", "copy-png"],
        },
      });
      await nextTick();
      expect(
        buttonChart
          .findComponent(ChartMenu)
          .props("items")
          .map((item) => item.label),
      ).toEqual(["Copy PNG", "Save SVG"]);
      expect(buttonChart.find("a.line-chart-download-link").exists()).toBe(
        false,
      );
      buttonChart.find("button.line-chart-download-button").trigger("click");
      expect(csvSpy).toHaveBeenLastCalledWith("custom,csv\n1,2", "chart");
    });

    it("expands fullscreen with Escape handling, body overflow lock, and attr forwarding", async () => {
      document.body.style.overflow = "auto";
      const wrapper = mount(LineChart, {
        props: { data: [1, 2, 3], height: 100 },
        attrs: { "data-testid": "my-chart", class: "consumer-class" },
        attachTo: document.body,
      });
      expect(
        wrapper.find(".line-chart-wrapper").attributes("data-testid"),
      ).toBe("my-chart");
      expect(wrapper.find(".line-chart-wrapper").classes()).toContain(
        "consumer-class",
      );

      const expanded = () =>
        document.querySelector<HTMLElement>(
          ".line-chart-wrapper.is-fullscreen",
        );
      menuItem(wrapper, "Fullscreen").action();
      await nextTick();
      expect(expanded()?.style.position).toBe("fixed");
      expect(document.body.style.overflow).toBe("hidden");
      expect(document.querySelector(".chart-close-button")).not.toBeNull();

      // Escape inside an open menu does not collapse fullscreen.
      const menu = document.createElement("div");
      menu.setAttribute("role", "menu");
      const item = document.createElement("button");
      menu.appendChild(item);
      document.body.appendChild(menu);
      item.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      await nextTick();
      expect(expanded()).not.toBeNull();
      document.body.removeChild(menu);

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await nextTick();
      expect(expanded()).toBeNull();
      expect(document.body.style.overflow).toBe("auto");
      wrapper.unmount();
      document.body.style.overflow = "";
    });
  });

  describe("areaSections, annotations, and markers", () => {
    it("places areaSections by startX/endX, stacks/clamps labels, and ignores empty ranges", () => {
      const xValues = [10, 20, 30, 40];
      const sectionPath = (section: AreaSection) =>
        mount(LineChart, {
          props: {
            ...baseProps,
            series: [{ x: xValues, data: [0, 10, 20, 30] }],
            areaSections: [section],
          },
        })
          .findAll("path")[1]
          .attributes("d")!;
      expect(sectionPath({ seriesIndex: 0, startX: 15, endX: 30 })).toBe(
        sectionPath({ seriesIndex: 0, startIndex: 1, endIndex: 2 }),
      );
      expect(sectionPath({ startX: -50, endX: 100 })).toBe(
        sectionPath({ startX: 10, endX: 40 }),
      );

      const empty = mount(LineChart, {
        props: {
          ...baseProps,
          series: [{ x: ["2026-01-01", "2026-01-02"], data: [0, 10] }],
          areaSections: [
            { startX: "2025-01-01", endX: "2025-06-01", label: "Before" },
          ],
        },
      });
      expect(empty.findAll("path")).toHaveLength(1);
      expect(empty.html()).not.toContain("NaN");

      const stacked = mount(LineChart, {
        props: {
          ...baseProps,
          series: [{ data: [0, 10, 20, 30, 40] }],
          areaSections: [
            { startIndex: 0, endIndex: 2, label: "First section label" },
            { startIndex: 1, endIndex: 4, label: "x".repeat(40) },
          ],
        },
      });
      expect(Number(stacked.find("svg").attributes("height"))).toBeGreaterThan(
        200,
      );
      const labelEls = stacked.findAll('[data-testid="section-label"] text');
      expect(labelEls[0].attributes("y")).not.toBe(labelEls[1].attributes("y"));
      expect(Number(labelEls[1].attributes("x")) + 40 * 7).toBeLessThanOrEqual(
        390,
      );
    });

    it("renders curved, straight, and rule annotations with markdown, inline arrow, and xMin offset", () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          data: [0, 10, 20],
          xMin: 100,
          tooltipTrigger: "hover",
          annotations: [
            {
              x: 101,
              y: 10,
              offset: { x: 30, y: -20 },
              text: "Peak: **Day 1**\n_italic_",
              lineColor: "#ff0000",
            },
            { x: 102, y: 20, offset: { x: 0, y: -30 }, text: "Straight" },
            {
              x: 101,
              y: 10,
              offset: { x: 20, y: -20 },
              text: "Rule",
              pointer: "ruleX",
              lineDash: 3,
            },
          ],
        },
      });
      const group = wrapper.find("g.chart-annotations");
      expect(group.find("marker").exists()).toBe(false);
      expect(
        group.find("polygon:not(.annotation-outline)").attributes("fill"),
      ).toBe("#ff0000");
      const paths = group
        .findAll("path:not(.annotation-outline)")
        .map((path) => path.attributes("d")!);
      expect(paths[0]).toMatch(/^M[\d.,-]+ Q[\d.,-]+ [\d.,-]+$/);
      expect(paths[1]).toMatch(/^M[\d.,-]+ L[\d.,-]+$/);
      const rule = group.find("line:not(.annotation-outline)");
      expect(Number(rule.attributes("x1"))).toBeCloseTo(220, 0);
      expect(Number(rule.attributes("y1"))).toBeCloseTo(10, 0);
      expect(Number(rule.attributes("y2"))).toBeCloseTo(170, 0);
      expect(rule.attributes("stroke-dasharray")).toBe("3 3");
      const runs = group.findAll("text > tspan > tspan");
      expect(
        runs.find((run) => run.text() === "Day 1")?.attributes("font-weight"),
      ).toBe("700");
      expect(
        runs.find((run) => run.text() === "italic")?.attributes("font-style"),
      ).toBe("italic");
      const children = Array.from(wrapper.find("svg").element.children);
      expect(children.indexOf(group.element)).toBeGreaterThan(
        children.indexOf(findOverlay(wrapper).element),
      );
    });

    it("renders markers with pills/collision rows, drags with bounds/snap, and hides tooltip while dragging", async () => {
      const markerProps = {
        data: [0, 2, 4, 6, 8, 10, 8, 6, 4, 2, 0],
        width: 600,
        height: 300,
        menu: false,
      };
      const layout = mount(LineChart, {
        props: {
          ...markerProps,
          markers: [
            { x: 5, label: "Alpha", color: "#0057b7", labelBackground: true },
            { x: 5.2, label: "Beta" },
            { x: "not-a-date" },
          ],
        },
      });
      expect(layout.findAll('[data-testid="marker-line"]')).toHaveLength(2);
      expect(
        layout.find('[data-testid="marker-label-bg"]').attributes("fill"),
      ).toBe("#0057b7");
      const labels = layout.findAll('[data-testid="marker-label"]');
      expect(Number(labels[1].attributes("y"))).toBeGreaterThan(
        Number(labels[0].attributes("y")),
      );

      const dragChart = mount(LineChart, {
        props: {
          ...markerProps,
          tooltipTrigger: "hover",
          markers: [{ x: 5, label: "Peak", min: 3, max: 7 }],
        },
        attachTo: document.body,
      });
      const hit = dragChart.find('[data-testid="marker-hit"]');
      const lastX = () =>
        (dragChart.emitted("update:markers")!.at(-1)![0] as { x: number }[])[0]
          .x;
      await hit.trigger("mousemove", { clientX: 320, clientY: 50 });
      expect(dragChart.emitted("hover")!.at(-1)![0]).toEqual({
        index: expect.any(Number),
      });

      // Grab 5px right of x=5 (320px), move +108px (+2 units) to x=7.
      await hit.trigger("pointerdown", {
        clientX: 325,
        button: 0,
        pointerId: 1,
      });
      expect(dragChart.emitted("hover")!.at(-1)![0]).toBeNull();
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 433 }));
      await nextTick();
      expect(
        Number(dragChart.find('[data-testid="marker-value"]').text()),
      ).toBe(7);
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 433 }));
      await nextTick();
      expect(lastX()).toBeCloseTo(7);
      expect(dragChart.emitted("markerDragEnd")).toHaveLength(1);
      await dragChart.setProps({
        markers: [{ x: 7, label: "Peak", min: 3, max: 7 }],
      });
      await hit.trigger("keydown", { key: "ArrowRight" });
      expect(lastX()).toBe(7);
      await hit.trigger("keydown", { key: "ArrowLeft" });
      expect(lastX()).toBe(6);
      dragChart.unmount();

      // Snapping to series x and whole days on a date axis.
      const snapChart = mount(LineChart, {
        props: {
          ...markerProps,
          x: [0, 3, 4, 10],
          data: [0, 5, 5, 0],
          markers: [{ x: 3, snap: true }],
        },
        attachTo: document.body,
      });
      await snapChart
        .find('[data-testid="marker-hit"]')
        .trigger("pointerdown", { clientX: 212, pointerId: 1 });
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 282 }));
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 282 }));
      await nextTick();
      expect(
        (snapChart.emitted("update:markers")!.at(-1)![0] as { x: number }[])[0]
          .x,
      ).toBe(4);
      snapChart.unmount();

      const dateChart = mount(LineChart, {
        props: {
          x: ["2026-01-01", "2026-01-11"],
          y: [0, 10],
          width: 600,
          height: 300,
          menu: false,
          markers: [{ x: "2026-01-06", snap: 86_400_000 }],
        },
        attachTo: document.body,
      });
      await dateChart
        .find('[data-testid="marker-hit"]')
        .trigger("pointerdown", { clientX: 320, pointerId: 1 });
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 400 }));
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 400 }));
      await nextTick();
      expect(
        (
          dateChart.emitted("update:markers")!.at(-1)![0] as { x: Date }[]
        )[0].x.toISOString(),
      ).toBe("2026-01-07T00:00:00.000Z");
      dateChart.unmount();
    });
  });

  describe("zoom, legend interaction, and intervals", () => {
    const zoomProps = {
      data: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      width: 600,
      height: 300,
      menu: false,
      zoom: true,
    };

    async function dragZoom(
      wrapper: Wrapper,
      from: { clientX: number; clientY?: number },
      to: { clientX: number; clientY?: number },
      release = true,
    ) {
      await findOverlay(wrapper).trigger("pointerdown", { ...from, button: 0 });
      window.dispatchEvent(new MouseEvent("pointermove", to));
      await nextTick();
      if (release) {
        window.dispatchEvent(new MouseEvent("pointerup", to));
        await nextTick();
      }
    }

    it("handles brush zoom, Escape cancel, touch ignore, box zoom clipping, monotone culling, and reset", async () => {
      const wrapper = mount(LineChart, {
        props: {
          ...zoomProps,
          markers: [{ x: 1 }, { x: 4 }],
          tooltipTrigger: "click",
        },
      });
      const fullX = tickNumbers(wrapper, "x-tick");

      await dragZoom(wrapper, { clientX: 158 }, { clientX: 160 });
      expect(wrapper.find('[aria-label="Reset zoom"]').exists()).toBe(false);
      await dragZoom(wrapper, { clientX: 158 }, { clientX: 374 }, false);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 374 }));
      await nextTick();
      expect(wrapper.find('[aria-label="Reset zoom"]').exists()).toBe(false);

      await findOverlay(wrapper).trigger("pointerdown", {
        clientX: 158,
        button: 0,
        pointerType: "touch",
      });
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 374 }));
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 374 }));
      await nextTick();
      expect(wrapper.find('[aria-label="Reset zoom"]').exists()).toBe(false);

      await dragZoom(wrapper, { clientX: 158 }, { clientX: 374 });
      await findOverlay(wrapper).trigger("click", { clientX: 374 });
      expect(wrapper.emitted("hover")).toBeUndefined();
      expect(
        Math.min(...tickNumbers(wrapper, "x-tick")),
      ).toBeGreaterThanOrEqual(2);
      expect(Math.max(...tickNumbers(wrapper, "y-tick"))).toBeLessThanOrEqual(
        60,
      );
      expect(wrapper.findAll('[data-testid="marker-line"]')).toHaveLength(1);

      await wrapper.find('[aria-label="Reset zoom"]').trigger("click");
      expect(tickNumbers(wrapper, "x-tick")).toEqual(fullX);
      await dragZoom(wrapper, { clientX: 158 }, { clientX: 374 });
      await findOverlay(wrapper).trigger("dblclick");
      expect(tickNumbers(wrapper, "x-tick")).toEqual(fullX);

      // Box zoom clips exact on the bottom edge cutting data, opens top edge.
      await dragZoom(
        wrapper,
        { clientX: 158, clientY: 62 },
        { clientX: 374, clientY: 166 },
      );
      const clip = wrapper.find("clipPath rect");
      expect(Number(clip.attributes("y"))).toBeLessThan(10);
      expect(
        Number(clip.attributes("y")) + Number(clip.attributes("height")),
      ).toBe(270);

      // Monotone tangents stay flat at culled window edges on alternating extrema.
      const monotoneChart = mount(LineChart, {
        props: {
          ...zoomProps,
          data: [0, 10, 0, 10, 0, 10, 0, 10, 0, 10, 0],
          curve: "monotone",
        },
      });
      await dragZoom(monotoneChart, { clientX: 158 }, { clientX: 374 });
      const pathData = monotoneChart
        .find('path[stroke="currentColor"]')
        .attributes("d")!;
      const parsePair = (text: string) => text.split(",").map(Number);
      let prevY = parsePair(pathData.match(/^M([^C]+)/)![1])[1];
      const curves = [...pathData.matchAll(/C([^C]+)/g)].map((match) =>
        parsePair(match[1]),
      );
      expect(curves).toHaveLength(6);
      for (const [, y1, , y2, , endY] of curves) {
        expect(y1).toBeCloseTo(prevY);
        expect(y2).toBeCloseTo(endY);
        prevY = endY;
      }
    });

    it("toggles/isolates/highlights legend series and preserves seriesIndex in tooltip", async () => {
      const wrapper = mount(LineChart, {
        props: {
          series: [
            { data: [0, 5, 10], legend: "Low", color: "red" },
            { data: [0, 500, 1000], legend: "High", color: "blue" },
          ],
          width: 600,
          height: 300,
          menu: false,
          legendToggle: true,
          legendHighlight: true,
        },
      });
      const buttons = wrapper.findAll(".chart-legend-toggle");
      await buttons[1].trigger("focus");
      expect(
        wrapper
          .findAll("g.legend-dim")
          .map((group) => group.attributes("opacity")),
      ).toEqual(["0.15", undefined]);
      expect(wrapper.emitted("legendHover")).toEqual([["High"]]);
      await buttons[1].trigger("click");
      expect(Math.max(...tickNumbers(wrapper, "y-tick"))).toBe(10);
      expect(wrapper.emitted("update:hiddenSeries")).toEqual([[["High"]]]);

      const isolateChart = mount(LineChart, {
        props: {
          ...baseProps,
          series: [
            { data: [1, 2], legend: "A" },
            { data: [2, 3], legend: "B" },
            { data: [3, 4], legend: "C" },
          ],
          legendToggle: "isolate",
        },
      });
      const isolateButtons = isolateChart.findAll(".chart-legend-toggle");
      await isolateButtons[1].trigger("click");
      expect(isolateChart.emitted("update:hiddenSeries")).toEqual([
        [["A", "C"]],
      ]);
      await isolateButtons[1].trigger("click");
      expect(isolateChart.emitted("update:hiddenSeries")!.at(-1)).toEqual([[]]);

      const controlled = mount(LineChart, {
        props: {
          ...baseProps,
          series: [
            { data: [1, 2], legend: "Low" },
            { data: [3, 4], legend: "High" },
          ],
          hiddenSeries: ["Low"],
          tooltipTrigger: "hover",
        },
        slots: {
          tooltip: `<template #tooltip="{ values }"><span class="tip">{{ values.map((v) => v.seriesIndex).join(",") }}</span></template>`,
        },
      });
      await findOverlay(controlled).trigger("mousemove", { clientX: 200 });
      expect(controlled.find(".tip").text()).toBe("1");
    });

    it("renders series and standalone intervals, extends axes, hides with series, and exports in tooltip/CSV", async () => {
      const wrapper = mount(LineChart, {
        props: {
          ...baseProps,
          series: [
            {
              data: [1, 2],
              lower: [0, 1],
              upper: [2, 3],
              color: "#123456",
              legend: "A",
            },
            { data: [4, 5], legend: "B" },
          ],
          intervals: [
            { x: 1, lower: 10, upper: 80, value: 15, seriesIndex: 0 },
          ],
          downloadLink: true,
          tooltipTrigger: "hover",
        },
        slots: {
          tooltip: `<template #tooltip="p"><div class="tt">{{ p.values[0].lower }}-{{ p.values[0].upper }}|{{ p.intervals.map(i => i.lower + '-' + i.upper).join() }}</div></template>`,
        },
      });
      const items = wrapper.findAll('[data-testid="interval"]');
      expect(items).toHaveLength(3);
      expect(items[0].find("line.interval-line").attributes("stroke")).toBe(
        "#123456",
      );
      expect(items[2].find("circle.interval-dot").exists()).toBe(true);
      expect(wrapper.findAll("text").map((text) => text.text())).toContain(
        "80",
      );

      await findOverlay(wrapper).trigger("mousemove", { clientX: 300 });
      expect(wrapper.find(".tt").text()).toBe("1-3|10-80");
      expect(
        decodeURIComponent(
          wrapper.find("a.line-chart-download-link").attributes("href") ?? "",
        ),
      ).toContain("index,A,A_lower,A_upper,B\n0,1,0,2,4\n1,2,1,3,5");

      await wrapper.setProps({ hiddenSeries: ["A"] });
      expect(wrapper.findAll('[data-testid="interval"]')).toHaveLength(0);
    });
  });
});

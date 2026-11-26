import { describe, it, expect, vi } from "vitest";
import { nextTick, reactive } from "vue";
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
const cells = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('[data-testid="cell"]');

function cellCenter(
  wrapper: ReturnType<typeof mount>,
  row: number,
  col: number,
) {
  const o = wrapper.get('[data-testid="chart-overlay"]').attributes();
  return {
    clientX:
      Number(o.x) + (col + 0.5) * (Number(o.width) / base.columns.length),
    clientY: Number(o.y) + (row + 0.5) * (Number(o.height) / base.rows.length),
  };
}

describe("Heatmap", () => {
  it("renders colored cells, optional missingColor, contrast-picked labels, and legends", () => {
    const wrapper = mount(Heatmap, {
      props: {
        ...base,
        colorScale: mono,
        cellLabels: true,
        valueFormat: "%.2f",
      },
    });
    expect(cells(wrapper)).toHaveLength(5);
    expect(cells(wrapper)[0].attributes("fill")).toBe("#000000");
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

    const withMissing = mount(Heatmap, {
      props: {
        ...base,
        missingColor: "#eeeeee",
        missingLabel: "-",
        valueFormat: "%.1f",
        colorScale: {
          domain: [-1, 0, 1],
          range: ["#f00", "#fff", "#00f"],
          label: "Score",
        },
      },
    });
    expect(cells(withMissing)).toHaveLength(6);
    expect(cells(withMissing)[4].attributes("fill")).toBe("#eeeeee");
    expect(
      withMissing.get('[data-testid="legend-color-scale-mid"]').text(),
    ).toBe("0.0");
    withMissing.unmount();

    const short = mount(Heatmap, {
      props: {
        ...base,
        cellLabels: { fontSize: 11 },
        height: 45,
        colorScale: { legend: false },
      },
    });
    expect(short.findAll('[data-testid="cell-label"]')).toHaveLength(0);
    expect(short.find('[data-testid="legend-color-scale"]').exists()).toBe(
      false,
    );
    short.unmount();
  });

  it("handles auto-height, top axis, row thinning, and rotated/shortened column labels", async () => {
    const { height: _unused, ...noHeight } = base;
    const two = mount(Heatmap, { props: { ...noHeight, cellHeight: 20 } });
    const four = mount(Heatmap, {
      props: {
        ...noHeight,
        cellHeight: 20,
        rows: ["a", "b", "c", "d"],
        data: [[1], [2], [3], [4]],
      },
    });
    expect(
      Number(four.get("svg").attributes("height")) -
        Number(two.get("svg").attributes("height")),
    ).toBe(40);
    two.unmount();
    four.unmount();

    const longColumns = [
      "Ensemble forecast model",
      "Baseline persistence",
      "Renewal equation",
      "Trend extrapolation",
    ];
    const rotated = mount(Heatmap, {
      props: {
        ...base,
        columns: longColumns,
        data: [
          [1, 2, 3, 4],
          [4, 3, 2, 1],
        ],
        width: 240,
        height: 160,
        columnAxis: "top",
        columnLabelAngle: -90,
        rowHeader: "Location",
      },
    });
    const firstLabel = rotated.get('[data-testid="column-label"]');
    expect(firstLabel.attributes("transform")).toMatch(/^rotate\(-90,/);
    expect(firstLabel.text()).toMatch(/…$/);
    await firstLabel.trigger("click");
    expect(rotated.emitted("columnClick")![0]).toEqual([
      { index: 0, label: longColumns[0] },
    ]);
    rotated.unmount();
  });

  it("handles hover tooltip, cellClick, and closes tooltip on in-place row reorder", async () => {
    const rows = reactive(["AZ", "CA"]);
    const data = reactive([
      [0, 0.5, 1],
      [1, NaN, 0],
    ]);
    const wrapper = mount(Heatmap, {
      props: { ...base, rows, data, colorScale: mono, tooltipTrigger: "hover" },
    });
    const overlay = wrapper.get('[data-testid="chart-overlay"]');
    const target = cellCenter(wrapper, 1, 2);

    await overlay.trigger("mousemove", target);
    expect(wrapper.emitted("hover")![0][0]).toEqual({ index: 5 });
    expect(wrapper.get(".chart-tooltip-label").text()).toBe("CA");

    await overlay.trigger("click", target);
    expect(wrapper.emitted("cellClick")![0][0]).toMatchObject({
      row: "CA",
      column: "c",
      value: 0,
      color: "#000000",
    });

    rows.reverse();
    data.reverse();
    await nextTick();
    expect(wrapper.find(".chart-tooltip-content").exists()).toBe(false);
    wrapper.unmount();
  });

  it("scrolls sideways with pinned row labels when columns pass minCellWidth", async () => {
    const columns = ["a", "b", "c", "d", "e", "f"];
    const wrapper = mount(Heatmap, {
      props: {
        ...base,
        columns,
        data: base.rows.map(() => columns.map((_, i) => i)),
        width: 300,
        minCellWidth: 100,
        rowHeader: "State",
        interactive: true,
        tooltipTrigger: "hover",
      },
    });
    expect(
      Number(wrapper.get('[data-testid="chart-overlay"]').attributes("width")) /
        columns.length,
    ).toBeCloseTo(100);
    expect(wrapper.get(".heatmap-plot").classes()).toContain("is-scrolling");

    const pinned = wrapper.get(".heatmap-pinned");
    expect(
      pinned.findAll('[data-testid="pinned-row-label"]').map((l) => l.text()),
    ).toEqual(["AZ", "CA"]);
    expect(pinned.find('[data-testid="pinned-bg"]').exists()).toBe(false);
    await pinned
      .findAll('[data-testid="pinned-row-label"]')[1]
      .trigger("click");
    expect(wrapper.emitted("rowClick")![0][0]).toEqual({
      index: 1,
      label: "CA",
    });

    await wrapper
      .get('[data-testid="chart-overlay"]')
      .trigger("mousemove", cellCenter(wrapper, 0, 0));
    const scroller = wrapper.get(".heatmap-plot");
    Object.defineProperty(scroller.element, "scrollLeft", { value: 40 });
    await scroller.trigger("scroll");
    expect(pinned.find('[data-testid="pinned-bg"]').exists()).toBe(true);
    expect(wrapper.find(".chart-tooltip-content").exists()).toBe(false);

    await wrapper.setProps({ width: 1000 });
    expect(wrapper.find(".heatmap-pinned").exists()).toBe(false);
    wrapper.unmount();
  });

  it("supports keyboard roving tabindex, Escape tooltip close, and CSV export", async () => {
    const wrapper = mount(Heatmap, {
      props: {
        ...base,
        interactive: true,
        tooltipTrigger: "hover",
        menu: true,
        yLabel: "State",
        rowHeader: "Location",
      },
      attachTo: document.body,
    });
    const button = (row: number, col: number) =>
      wrapper.get(`[data-cell="${row}:${col}"]`);
    expect(wrapper.findAll('.heatmap-cell-button[tabindex="0"]')).toHaveLength(
      1,
    );

    await button(0, 0).trigger("keydown", { key: "ArrowRight" });
    await nextTick();
    expect(document.activeElement).toBe(button(0, 1).element);

    (button(0, 2).element as HTMLButtonElement).focus();
    await nextTick();
    expect(wrapper.find(".chart-tooltip-content").exists()).toBe(true);
    button(0, 2).element.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await nextTick();
    expect(wrapper.find(".chart-tooltip-content").exists()).toBe(false);

    const spy = vi.spyOn(download, "downloadCsv").mockImplementation(() => {});
    wrapper
      .findComponent(ChartMenu)
      .props("items")
      .find((i) => i.label === "Download CSV")!
      .action();
    expect(spy.mock.calls[0][0]).toBe("Location,a,b,c\nAZ,0,0.5,1\nCA,1,NaN,0");
    spy.mockRestore();
    wrapper.unmount();
  });
});

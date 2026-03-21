import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DataTable from "./DataTable.vue";
import { ModelOutput } from "@cfasim-ui/shared";

describe("Table", () => {
  it("renders a plain record", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: {
          day: [0, 1, 2],
          infected: [10, 25, 50],
        },
      },
    });
    const headers = wrapper.findAll("th");
    expect(headers.map((h) => h.text())).toEqual(["day", "infected"]);
    const rows = wrapper.findAll("tbody tr");
    expect(rows).toHaveLength(3);
    expect(rows[0].findAll("td").map((td) => td.text())).toEqual(["0", "10"]);
    expect(rows[2].findAll("td").map((td) => td.text())).toEqual(["2", "50"]);
  });

  it("formats floats to 4 decimal places", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { value: [1.23456789] },
      },
    });
    const cell = wrapper.find("tbody td");
    expect(cell.text()).toBe("1.2346");
  });

  it("renders a ModelOutput", () => {
    const output = new ModelOutput(
      2,
      [
        { name: "day", type: "i32" },
        { name: "cases", type: "f64" },
      ],
      [new Int32Array([0, 1]), new Float64Array([100.5, 200.75])],
    );
    const wrapper = mount(DataTable, { props: { data: output } });
    const headers = wrapper.findAll("th");
    expect(headers.map((h) => h.text())).toEqual(["day", "cases"]);
    const rows = wrapper.findAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0].findAll("td").map((td) => td.text())).toEqual([
      "0",
      "100.5000",
    ]);
  });

  it("renders enum labels from ModelOutput", () => {
    const output = new ModelOutput(
      2,
      [{ name: "status", type: "enum", enumLabels: ["S", "I", "R"] }],
      [new Uint32Array([0, 2])],
    );
    const wrapper = mount(DataTable, { props: { data: output } });
    const cells = wrapper.findAll("tbody td");
    expect(cells.map((c) => c.text())).toEqual(["S", "R"]);
  });

  it("respects maxRows", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { x: [1, 2, 3, 4, 5] },
        maxRows: 3,
      },
    });
    expect(wrapper.findAll("tbody tr")).toHaveLength(3);
  });

  it("handles empty data", () => {
    const wrapper = mount(DataTable, { props: { data: {} } });
    expect(wrapper.findAll("th")).toHaveLength(0);
    expect(wrapper.findAll("tbody tr")).toHaveLength(0);
  });

  it("uses columnConfig labels", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0], infected: [10] },
        columnConfig: {
          day: { label: "Day #" },
          infected: { label: "Total Infected" },
        },
      },
    });
    const headers = wrapper.findAll("th");
    expect(headers.map((h) => h.text())).toEqual(["Day #", "Total Infected"]);
  });

  it("falls back to column name when no label configured", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0], infected: [10] },
        columnConfig: { day: { label: "Day #" } },
      },
    });
    const headers = wrapper.findAll("th");
    expect(headers.map((h) => h.text())).toEqual(["Day #", "infected"]);
  });

  it("applies named column widths", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0], infected: [10] },
        columnConfig: {
          day: { width: "small" },
          infected: { width: "large" },
        },
      },
    });
    const cols = wrapper.findAll("col");
    expect(cols[0].attributes("style")).toContain("width: 80px");
    expect(cols[1].attributes("style")).toContain("width: 250px");
  });

  it("applies pixel column widths", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0] },
        columnConfig: { day: { width: 120 } },
      },
    });
    const col = wrapper.find("col");
    expect(col.attributes("style")).toContain("width: 120px");
    expect(col.attributes("style")).toContain("min-width: 120px");
  });

  it("applies column alignment to th and td", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0], infected: [10] },
        columnConfig: {
          day: { align: "center" },
          infected: { align: "left" },
        },
      },
    });
    const headers = wrapper.findAll("th");
    expect(headers[0].attributes("style")).toContain("text-align: center");
    expect(headers[1].attributes("style")).toContain("text-align: left");
    const cells = wrapper.findAll("tbody td");
    expect(cells[0].attributes("style")).toContain("text-align: center");
    expect(cells[1].attributes("style")).toContain("text-align: left");
  });

  it("uses default alignment when no align configured", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0] },
      },
    });
    const th = wrapper.find("th");
    expect(th.attributes("style")).toBeUndefined();
  });

  it("applies cellClass to td elements", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0, 1], value: [10, 20] },
        columnConfig: {
          day: { cellClass: "text-secondary" },
        },
      },
    });
    const rows = wrapper.findAll("tbody tr");
    for (const row of rows) {
      const cells = row.findAll("td");
      expect(cells[0].classes()).toContain("text-secondary");
      expect(cells[1].classes()).not.toContain("text-secondary");
    }
  });
});

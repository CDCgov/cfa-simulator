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

  it("renders date columns from ModelOutput as ISO dates", () => {
    const output = new ModelOutput(
      2,
      [{ name: "when", type: "date" }],
      [new Uint32Array([20458, 0xffffffff])],
    );
    const wrapper = mount(DataTable, { props: { data: output } });
    const cells = wrapper.findAll("tbody td").map((td) => td.text());
    expect(cells).toEqual(["2026-01-05", ""]);
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

  it("passes other CSS lengths through", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0], value: [1] },
        columnConfig: { day: { width: "12rem" }, value: { width: "30%" } },
      },
    });
    const cols = wrapper.findAll("col");
    expect(cols[0].attributes("style")).toContain("width: 12rem");
    expect(cols[0].attributes("style")).toContain("min-width: 12rem");
    expect(cols[1].attributes("style")).toContain("width: 30%");
  });

  it("applies a default medium width to columns without explicit width", () => {
    const wrapper = mount(DataTable, {
      props: { data: { day: [0], infected: [10] } },
    });
    const cols = wrapper.findAll("col");
    for (const col of cols) {
      expect(col.attributes("style")).toContain("width: 150px");
    }
  });

  it("omits column widths when fullWidth is set (no explicit width)", () => {
    const wrapper = mount(DataTable, {
      props: { data: { day: [0], infected: [10] }, fullWidth: true },
    });
    const cols = wrapper.findAll("col");
    for (const col of cols) {
      expect(col.attributes("style")).toBeUndefined();
    }
  });

  it("adds the full-width class to the table and outer when fullWidth is true", () => {
    const wrapper = mount(DataTable, {
      props: { data: { day: [0] }, fullWidth: true },
    });
    expect(wrapper.find("table").classes()).toContain("full-width");
    expect(wrapper.find(".TableOuter").classes()).toContain("full-width");
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

  it("applies columnClass to both th and td of a column", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0, 1], infected: [10, 20] },
        columnConfig: {
          infected: { columnClass: "totals" },
        },
      },
    });
    const headers = wrapper.findAll("th");
    expect(headers[0].classes()).not.toContain("totals");
    expect(headers[1].classes()).toContain("totals");
    const infectedCells = wrapper
      .findAll("tbody td")
      .filter((_, i) => i % 2 === 1);
    for (const cell of infectedCells) {
      expect(cell.classes()).toContain("totals");
    }
  });

  it("keeps cellClass body-only (does not apply to th)", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0], infected: [10] },
        columnConfig: {
          infected: { cellClass: "highlight" },
        },
      },
    });
    expect(wrapper.findAll("th")[1].classes()).not.toContain("highlight");
    expect(wrapper.findAll("tbody td")[1].classes()).toContain("highlight");
  });

  it("adds cell-wrap class to th and td when wrap is true", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { name: ["alpha"], note: ["a long note"] },
        columnConfig: {
          note: { wrap: true },
        },
      },
    });
    const headers = wrapper.findAll("th");
    expect(headers[0].classes()).not.toContain("cell-wrap");
    expect(headers[1].classes()).toContain("cell-wrap");
    const cells = wrapper.findAll("tbody td");
    expect(cells[0].classes()).not.toContain("cell-wrap");
    expect(cells[1].classes()).toContain("cell-wrap");
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

  describe("striped", () => {
    it("is off by default", () => {
      const wrapper = mount(DataTable, { props: { data: { a: [1, 2] } } });
      expect(wrapper.find("table").classes()).not.toContain("striped");
    });

    it("adds the striped class, and a custom color as a CSS variable", () => {
      const plain = mount(DataTable, {
        props: { data: { a: [1, 2] }, striped: true },
      });
      expect(plain.find("table").classes()).toContain("striped");
      expect(plain.find("table").attributes("style")).toBeUndefined();

      const colored = mount(DataTable, {
        props: { data: { a: [1, 2] }, striped: "#eef" },
      });
      expect(colored.find("table").classes()).toContain("striped");
      expect(colored.find("table").attributes("style")).toContain(
        "--data-table-stripe-color: #eef",
      );
    });
  });

  describe("cell slots", () => {
    it("renders columns through the template named in columnConfig", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: {
            name: ["a", "b"],
            fill: ["#f00", "#00f"],
            stroke: ["#0f0", "#000"],
          },
          columnConfig: {
            fill: { template: "swatch", format: (v: unknown) => `c:${v}` },
            stroke: { template: "swatch" },
          },
        },
        slots: {
          swatch: `<template #swatch="{ value, text, row, column }">
            <span class="swatch" :data-value="value">{{ text }}/{{ row }}/{{ column }}</span>
          </template>`,
        },
      });
      const tds = wrapper.findAll("tbody tr")[1].findAll("td");
      expect(tds[0].text()).toBe("b");
      expect(tds[0].find(".swatch").exists()).toBe(false);
      expect(tds[1].find(".swatch").attributes("data-value")).toBe("#00f");
      expect(tds[1].text()).toBe("c:#00f/1/fill");
      expect(tds[2].text()).toBe("#000/1/stroke");
    });

    it("picks a template per cell from a function", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { delta: [-2, 3, 0] },
          columnConfig: {
            delta: {
              template: (v: unknown, row: number) =>
                row === 2 ? undefined : (v as number) < 0 ? "down" : "up",
            },
          },
        },
        slots: {
          up: `<template #up="{ text }"><b>+{{ text }}</b></template>`,
          down: `<template #down="{ text }"><i>{{ text }}</i></template>`,
        },
      });
      const tds = wrapper.findAll("tbody td");
      expect(tds[0].find("i").text()).toBe("-2");
      expect(tds[1].find("b").text()).toBe("+3");
      expect(tds[2].html()).not.toMatch(/<[bi]>/);
      expect(tds[2].text()).toBe("0");
    });

    it("falls back to text when the named template is not provided", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { a: [1] },
          columnConfig: { a: { template: "missing" } },
        },
      });
      expect(wrapper.find("tbody td").text()).toBe("1");
    });

    it("passes source row indices when sorted, and CSV keeps the text", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { v: [3, 1, 2] },
          columnConfig: { v: { template: "rowCell" } },
          sort: { column: "v", direction: "asc" },
          downloadLink: true,
        },
        slots: {
          rowCell: `<template #rowCell="{ row }"><em>row {{ row }}</em></template>`,
        },
      });
      expect(wrapper.findAll("tbody td").map((td) => td.text())).toEqual([
        "row 1",
        "row 2",
        "row 0",
      ]);
      const href = wrapper
        .find(".data-table-download-link")
        .attributes("href")!;
      expect(decodeURIComponent(href.split(",")[1])).toBe("v\n1\n2\n3");
    });
  });

  describe("sorting", () => {
    const column = (wrapper: ReturnType<typeof mount>, i: number) =>
      wrapper.findAll("tbody tr").map((tr) => tr.findAll("td")[i].text());

    it("renders no sort buttons by default", () => {
      const wrapper = mount(DataTable, { props: { data: { day: [0, 1] } } });
      expect(wrapper.find(".data-table-sort-button").exists()).toBe(false);
      expect(wrapper.find("th").attributes("aria-sort")).toBeUndefined();
    });

    it("cycles ascending, descending, then original order", async () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { name: ["b", "c", "a"], cases: [20, 5, 10] },
          sortable: true,
        },
      });
      const button = wrapper.findAll(".data-table-sort-button")[1];
      const th = wrapper.findAll("th")[1];

      await button.trigger("click");
      expect(column(wrapper, 1)).toEqual(["5", "10", "20"]);
      expect(column(wrapper, 0)).toEqual(["c", "a", "b"]);
      expect(th.attributes("aria-sort")).toBe("ascending");
      expect(wrapper.emitted("update:sort")![0]).toEqual([
        { column: "cases", direction: "asc" },
      ]);

      await button.trigger("click");
      expect(column(wrapper, 1)).toEqual(["20", "10", "5"]);
      expect(th.attributes("aria-sort")).toBe("descending");

      await button.trigger("click");
      expect(column(wrapper, 1)).toEqual(["20", "5", "10"]);
      expect(th.attributes("aria-sort")).toBeUndefined();
      expect(wrapper.emitted("update:sort")![2]).toEqual([null]);
    });

    it("sorts strings naturally and keeps missing values last", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { id: ["x10", "x2", "", "x1"], v: [3, NaN, 1, 2] },
          sort: { column: "v", direction: "desc" },
        },
      });
      expect(column(wrapper, 1)).toEqual(["3", "2", "1", "NaN"]);
      return wrapper
        .setProps({ sort: { column: "id", direction: "asc" } })
        .then(() => {
          expect(column(wrapper, 0)).toEqual(["x1", "x2", "x10", ""]);
        });
    });

    it("sorts enums by label and dates by day, missing dates last", () => {
      const output = new ModelOutput(
        3,
        [
          { name: "state", type: "enum", enumLabels: ["S", "", "R"] },
          { name: "when", type: "date" },
        ],
        [
          new Uint32Array([0, 1, 2]),
          new Uint32Array([20458, 0xffffffff, 20000]),
        ],
      );
      const wrapper = mount(DataTable, {
        props: { data: output, sort: { column: "state", direction: "asc" } },
      });
      expect(column(wrapper, 0)).toEqual(["R", "S", ""]);
      return wrapper
        .setProps({ sort: { column: "when", direction: "desc" } })
        .then(() => {
          expect(column(wrapper, 1)).toEqual(["2026-01-05", "2024-10-04", ""]);
        });
    });

    it("sorts before applying maxRows and passes original rows to format", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { cases: [1, 30, 20, 40] },
          maxRows: 2,
          sort: { column: "cases", direction: "desc" },
          columnConfig: { cases: { format: (v, row) => `${v}@${row}` } },
        },
      });
      expect(column(wrapper, 0)).toEqual(["40@3", "30@1"]);
    });

    it("clears the sort when its column leaves the data", async () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { a: [2, 1], b: [3, 4] },
          sort: { column: "b", direction: "desc" },
        },
      });
      await wrapper.setProps({ data: { a: [2, 1] } });
      expect(wrapper.emitted("update:sort")!.at(-1)).toEqual([null]);
      expect(column(wrapper, 0)).toEqual(["2", "1"]);
    });

    it("lets columnConfig opt columns in or out", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { a: [1], b: [2], c: [3] },
          sortable: true,
          columnConfig: { b: { sortable: false } },
        },
      });
      const ths = wrapper.findAll("th");
      expect(ths.map((th) => th.find("button").exists())).toEqual([
        true,
        false,
        true,
      ]);
      const only = mount(DataTable, {
        props: {
          data: { a: [1], b: [2] },
          columnConfig: { b: { sortable: true } },
        },
      });
      expect(only.findAll(".data-table-sort-button")).toHaveLength(1);
    });

    it("exports CSV in the displayed order", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { cases: [2, 1, 3] },
          sort: { column: "cases", direction: "asc" },
          downloadLink: true,
        },
      });
      const href = wrapper
        .find(".data-table-download-link")
        .attributes("href")!;
      expect(decodeURIComponent(href.split(",")[1])).toBe("cases\n1\n2\n3");
    });
  });

  describe("download menu", () => {
    it("renders the menu by default with a Download item", () => {
      const wrapper = mount(DataTable, {
        props: { data: { day: [0, 1], value: [10, 20] } },
      });
      const menu = wrapper.findComponent({ name: "ChartMenu" });
      expect(menu.exists()).toBe(true);
      expect(menu.props("items")).toEqual([
        expect.objectContaining({ label: "Download" }),
      ]);
      expect(menu.props("forceDropdown")).toBe(true);
    });

    it("uses downloadMenuLink as the menu item label", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { day: [0], value: [10] },
          downloadMenuLink: "Download cases (CSV)",
        },
      });
      const menu = wrapper.findComponent({ name: "ChartMenu" });
      expect(menu.props("items")[0].label).toBe("Download cases (CSV)");
    });

    it("hides the menu when menu prop is false", () => {
      const wrapper = mount(DataTable, {
        props: { data: { day: [0] }, menu: false },
      });
      expect(wrapper.findComponent({ name: "ChartMenu" }).exists()).toBe(false);
    });

    it("does not render the legacy download link", () => {
      const wrapper = mount(DataTable, {
        props: { data: { day: [0], value: [10] } },
      });
      expect(wrapper.find("a.data-table-download-link").exists()).toBe(false);
    });

    it("renders a visible download button when downloadButton is true", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { day: [0], value: [10] },
          downloadButton: true,
          downloadMenuLink: "Download CSV",
        },
      });
      const button = wrapper.find("button.data-table-download-button");
      expect(button.exists()).toBe(true);
      expect(button.text()).toBe("Download CSV");
    });

    it("suppresses the menu Download item when downloadButton is true", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { day: [0], value: [10] },
          downloadButton: true,
        },
      });
      expect(wrapper.findComponent({ name: "ChartMenu" }).exists()).toBe(false);
    });

    it("renders a download link with default label when downloadLink is true", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { day: [0], value: [10] },
          downloadLink: true,
          filename: "cases",
        },
      });
      const link = wrapper.find("a.data-table-download-link");
      expect(link.exists()).toBe(true);
      expect(link.text()).toBe("Download data (CSV)");
      expect(link.attributes("download")).toBe("cases.csv");
      const href = link.attributes("href") ?? "";
      expect(href.startsWith("data:text/csv;")).toBe(true);
      const csv = decodeURIComponent(href.split(",").slice(1).join(","));
      expect(csv).toContain("day,value");
      expect(csv).toContain("0,10");
    });

    it("uses a custom label when downloadLink is a string", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { day: [0], value: [10] },
          downloadLink: "Grab the data",
        },
      });
      expect(wrapper.find("a.data-table-download-link").text()).toBe(
        "Grab the data",
      );
    });

    it("suppresses the menu Download item when downloadLink is set", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { day: [0], value: [10] },
          downloadLink: true,
        },
      });
      expect(wrapper.findComponent({ name: "ChartMenu" }).exists()).toBe(false);
    });

    it("downloadButton wins when both downloadButton and downloadLink are set", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { day: [0], value: [10] },
          downloadButton: true,
          downloadLink: true,
        },
      });
      expect(wrapper.find("button.data-table-download-button").exists()).toBe(
        true,
      );
      expect(wrapper.find("a.data-table-download-link").exists()).toBe(false);
    });

    it("downloads CSV when the button is clicked", () => {
      const wrapper = mount(DataTable, {
        props: {
          data: { day: [0, 1], value: [10, 20] },
          downloadButton: true,
        },
      });
      let downloaded = "";
      const orig = URL.createObjectURL;
      URL.createObjectURL = (blob: Blob) => {
        void (blob as Blob).text().then((t) => {
          downloaded = t;
        });
        return "blob:mock";
      };
      try {
        wrapper.find("button.data-table-download-button").trigger("click");
      } finally {
        URL.createObjectURL = orig;
      }
      return Promise.resolve().then(() => {
        expect(downloaded).toContain("day,value");
        expect(downloaded).toContain("0,10");
        expect(downloaded).toContain("1,20");
      });
    });
  });

  it("applies a NumberFormat preset to numeric cells", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0, 1], rate: [0.1234, 0.5] },
        columnConfig: { rate: { format: "percent:1" } },
      },
    });
    const rows = wrapper.findAll("tbody tr");
    expect(rows[0].findAll("td").map((td) => td.text())).toEqual([
      "0",
      "12.3%",
    ]);
    expect(rows[1].findAll("td").map((td) => td.text())).toEqual([
      "1",
      "50.0%",
    ]);
  });

  it("applies a sprintf-style format to numeric cells", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { cases: [1, 21] },
        columnConfig: { cases: { format: "%05d" } },
      },
    });
    const cells = wrapper.findAll("tbody td");
    expect(cells.map((c) => c.text())).toEqual(["00001", "00021"]);
  });

  it("falls back to default rendering when a string preset is applied to non-numeric cells", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { label: ["A", "B", "C"] },
        columnConfig: { label: { format: "percent" } },
      },
    });
    const cells = wrapper.findAll("tbody td");
    expect(cells.map((c) => c.text())).toEqual(["A", "B", "C"]);
  });

  it("uses columnConfig format to render cell values", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0, 1], rate: [0.123, 0.456] },
        columnConfig: {
          rate: { format: (v: number) => `${(v * 100).toFixed(1)}%` },
        },
      },
    });
    const rows = wrapper.findAll("tbody tr");
    expect(rows[0].findAll("td").map((td) => td.text())).toEqual([
      "0",
      "12.3%",
    ]);
    expect(rows[1].findAll("td").map((td) => td.text())).toEqual([
      "1",
      "45.6%",
    ]);
  });

  it("passes the row index to a column formatter", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { x: [10, 20, 30] },
        columnConfig: {
          x: {
            format: (v: number | string | boolean, r: number) => `${r}:${v}`,
          },
        },
      },
    });
    const cells = wrapper.findAll("tbody td");
    expect(cells.map((c) => c.text())).toEqual(["0:10", "1:20", "2:30"]);
  });

  it("does not call format for null/undefined values", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { x: [1, undefined as unknown as number, 3] },
        columnConfig: {
          x: { format: (v: number) => `v=${v}` },
        },
      },
    });
    const cells = wrapper.findAll("tbody td");
    expect(cells.map((c) => c.text())).toEqual(["v=1", "", "v=3"]);
  });

  it("format overrides enum labels from ModelOutput", () => {
    const output = new ModelOutput(
      2,
      [{ name: "status", type: "enum", enumLabels: ["S", "I", "R"] }],
      [new Uint32Array([0, 2])],
    );
    const wrapper = mount(DataTable, {
      props: {
        data: output,
        columnConfig: { status: { format: (v: number) => `#${v}` } },
      },
    });
    const cells = wrapper.findAll("tbody td");
    expect(cells.map((c) => c.text())).toEqual(["#0", "#2"]);
  });

  it("uses formatted values in CSV download", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0, 1], rate: [0.123, 0.456] },
        columnConfig: {
          rate: { format: (v: number) => `${(v * 100).toFixed(1)}%` },
        },
      },
    });
    const menu = wrapper.findComponent({ name: "ChartMenu" });
    const items = menu.props("items") as {
      label: string;
      action: () => void;
    }[];
    let downloaded = "";
    const orig = URL.createObjectURL;
    URL.createObjectURL = (blob: Blob) => {
      void (blob as Blob).text().then((t) => {
        downloaded = t;
      });
      return "blob:mock";
    };
    try {
      items[0].action();
    } finally {
      URL.createObjectURL = orig;
    }
    return Promise.resolve().then(() => {
      expect(downloaded).toContain("12.3%");
      expect(downloaded).toContain("45.6%");
    });
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

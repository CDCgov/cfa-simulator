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

  it("uses default alignment when no align configured", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0] },
      },
    });
    const th = wrapper.find("th");
    expect(th.attributes("style")).toBeUndefined();
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

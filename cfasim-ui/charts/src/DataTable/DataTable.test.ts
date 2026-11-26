import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DataTable from "./DataTable.vue";
import { ModelOutput } from "@cfasim-ui/shared";

const columnTexts = (wrapper: ReturnType<typeof mount>, colIndex: number) =>
  wrapper.findAll("tbody tr").map((row) => row.findAll("td")[colIndex].text());

const decodeCsvHref = (wrapper: ReturnType<typeof mount>) => {
  const href = wrapper.find(".data-table-download-link").attributes("href")!;
  return decodeURIComponent(href.split(",").slice(1).join(","));
};

describe("DataTable", () => {
  it("renders plain records, floats, maxRows, empty data, and ModelOutput with missingLabel", () => {
    const plain = mount(DataTable, {
      props: {
        data: { day: [0, 1, 2], value: [1.23456789, 2, 3] },
        maxRows: 2,
      },
    });
    expect(plain.findAll("th").map((h) => h.text())).toEqual(["day", "value"]);
    expect(plain.findAll("tbody tr")).toHaveLength(2);
    expect(
      plain
        .findAll("tbody tr")[0]
        .findAll("td")
        .map((td) => td.text()),
    ).toEqual(["0", "1.2346"]);

    const empty = mount(DataTable, { props: { data: {} } });
    expect(empty.findAll("th")).toHaveLength(0);

    const output = new ModelOutput(
      2,
      [
        { name: "when", type: "date" },
        { name: "rate", type: "f64" },
        { name: "status", type: "enum", enumLabels: ["S", "I", "R"] },
      ],
      [
        new Uint32Array([0xffffffff, 20458]),
        new Float64Array([NaN, 0.5]),
        new Uint32Array([0, 2]),
      ],
    );
    const model = mount(DataTable, {
      props: {
        data: output,
        missingLabel: "-",
        columnConfig: { rate: { format: "percent" } },
        downloadLink: true,
      },
    });
    expect(model.findAll("tbody td").map((td) => td.text())).toEqual([
      "-",
      "-",
      "S",
      "2026-01-05",
      "50%",
      "R",
    ]);
    expect(decodeCsvHref(model)).toBe(
      "when,rate,status\n,NaN,S\n2026-01-05,50%,R",
    );
  });

  it("applies preset, sprintf, function formatters, and cell slots with source row index", () => {
    const wrapper = mount(DataTable, {
      props: {
        data: {
          rate: [0.1234, 0.5],
          code: [1, 21],
          custom: [10, undefined as unknown as number],
          v: [3, 1],
        },
        columnConfig: {
          rate: { format: "percent:1" },
          code: { format: "%05d" },
          custom: {
            format: (value: unknown, row: number) => `${row}:${value}`,
          },
          v: {
            template: (value: unknown) =>
              (value as number) === 1 ? "badge" : undefined,
          },
        },
        sort: { column: "v", direction: "asc" },
      },
      slots: {
        badge: `<template #badge="{ value, row }"><b>{{ value }}@{{ row }}</b></template>`,
      },
    });
    expect(columnTexts(wrapper, 0)).toEqual(["50.0%", "12.3%"]);
    expect(columnTexts(wrapper, 1)).toEqual(["00021", "00001"]);
    expect(columnTexts(wrapper, 2)).toEqual(["", "0:10"]);
    expect(columnTexts(wrapper, 3)).toEqual(["1@1", "3"]);
  });

  it("cycles sort asc/desc/none, sorts strings/enums/dates with missing last, and resets when column leaves", async () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { name: ["b", "c", "a"], cases: [20, 5, 10] },
        sortable: true,
        columnConfig: { name: { sortable: false } },
      },
    });
    expect(wrapper.findAll(".data-table-sort-button")).toHaveLength(1);
    const button = wrapper.find(".data-table-sort-button");
    const header = wrapper.findAll("th")[1];

    await button.trigger("click");
    expect(columnTexts(wrapper, 1)).toEqual(["5", "10", "20"]);
    expect(header.attributes("aria-sort")).toBe("ascending");
    await button.trigger("click");
    expect(columnTexts(wrapper, 1)).toEqual(["20", "10", "5"]);
    expect(header.attributes("aria-sort")).toBe("descending");
    await button.trigger("click");
    expect(columnTexts(wrapper, 1)).toEqual(["20", "5", "10"]);
    expect(wrapper.emitted("update:sort")![2]).toEqual([null]);

    const output = new ModelOutput(
      3,
      [
        { name: "state", type: "enum", enumLabels: ["S", "", "R"] },
        { name: "when", type: "date" },
      ],
      [new Uint32Array([0, 1, 2]), new Uint32Array([20458, 0xffffffff, 20000])],
    );
    const model = mount(DataTable, {
      props: { data: output, sort: { column: "state", direction: "asc" } },
    });
    expect(columnTexts(model, 0)).toEqual(["R", "S", ""]);
    await model.setProps({ sort: { column: "when", direction: "desc" } });
    expect(columnTexts(model, 1)).toEqual(["2026-01-05", "2024-10-04", ""]);

    const natural = mount(DataTable, {
      props: {
        data: { id: ["x10", "x2", "", "x1"], cases: [1, 30, 20, 40] },
        sort: { column: "id", direction: "asc" },
      },
    });
    expect(columnTexts(natural, 0)).toEqual(["x1", "x2", "x10", ""]);
    await natural.setProps({
      maxRows: 2,
      sort: { column: "cases", direction: "desc" },
    });
    expect(columnTexts(natural, 1)).toEqual(["40", "30"]);
    await natural.setProps({ data: { id: ["a", "b"] } });
    expect(natural.emitted("update:sort")!.at(-1)).toEqual([null]);
  });

  it("exports formatted CSV via ChartMenu by default, and downloadButton supersedes downloadLink", async () => {
    const wrapper = mount(DataTable, {
      props: {
        data: { day: [0, 1], rate: [0.123, 0.456] },
        columnConfig: { rate: { format: "percent:1" } },
      },
    });
    let downloaded = "";
    const orig = URL.createObjectURL;
    URL.createObjectURL = (blob: Blob) => {
      void blob.text().then((text) => {
        downloaded = text;
      });
      return "blob:mock";
    };
    try {
      (
        wrapper.findComponent({ name: "ChartMenu" }).props("items") as {
          action: () => void;
        }[]
      )[0].action();
    } finally {
      URL.createObjectURL = orig;
    }
    await Promise.resolve();
    expect(downloaded).toContain("0,12.3%");

    const buttonTable = mount(DataTable, {
      props: { data: { day: [0] }, downloadButton: true, downloadLink: true },
    });
    expect(buttonTable.find("button.data-table-download-button").exists()).toBe(
      true,
    );
    expect(buttonTable.find("a.data-table-download-link").exists()).toBe(false);
    expect(buttonTable.findComponent({ name: "ChartMenu" }).exists()).toBe(
      false,
    );
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import DatePicker from "./DatePicker.vue";

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

function mountPicker(props: Record<string, unknown> = {}) {
  const w = mount(DatePicker, {
    attachTo: document.body,
    props: {
      label: "Start date",
      "onUpdate:modelValue": (v: string | undefined) =>
        w.setProps({ modelValue: v }),
      ...props,
    },
  });
  wrapper = w;
  return w;
}

const input = (w: VueWrapper) => w.find("input");

describe("DatePicker", () => {
  it("labels the input and uses the format as the placeholder", () => {
    const w = mountPicker({ modelValue: "2026-05-14" });
    const el = input(w).element as HTMLInputElement;
    expect(el.value).toBe("2026-05-14");
    expect(el.placeholder).toBe("yyyy-mm-dd");
    const label = w.find("label");
    expect(label.text()).toContain("Start date");
    expect(label.attributes("for")).toBe(el.id);
  });

  it("commits on blur, normalizing to the format", async () => {
    const w = mountPicker({ modelValue: "" });
    await input(w).setValue("2026-5-4");
    expect(w.props("modelValue")).toBe("");
    await input(w).trigger("blur");
    expect(w.props("modelValue")).toBe("2026-05-04");
    expect((input(w).element as HTMLInputElement).value).toBe("2026-05-04");
  });

  it("commits on Enter in a custom format", async () => {
    const w = mountPicker({ modelValue: "01/02/2026", format: "mm/dd/yyyy" });
    expect(input(w).attributes("placeholder")).toBe("mm/dd/yyyy");
    await input(w).setValue("12/25/2026");
    await input(w).trigger("keydown.enter");
    expect(w.props("modelValue")).toBe("12/25/2026");
  });

  it("flags invalid and out-of-range input without emitting", async () => {
    const w = mountPicker({
      modelValue: "2026-05-14",
      min: "2026-01-01",
      max: "2026-12-31",
    });
    await input(w).setValue("not a date");
    await input(w).trigger("blur");
    expect(input(w).attributes("aria-invalid")).toBe("true");
    expect(w.props("modelValue")).toBe("2026-05-14");

    await input(w).setValue("2027-01-01");
    await input(w).trigger("blur");
    expect(input(w).attributes("aria-invalid")).toBe("true");
    expect(w.props("modelValue")).toBe("2026-05-14");

    await input(w).setValue("2026-06-01");
    await input(w).trigger("blur");
    expect(input(w).attributes("aria-invalid")).toBeUndefined();
    expect(w.props("modelValue")).toBe("2026-06-01");
  });

  it("flags a model value that does not match the format", () => {
    const w = mountPicker({ modelValue: "2026-05-14", format: "dd/mm/yyyy" });
    expect(input(w).attributes("aria-invalid")).toBe("true");
  });

  describe("validation messages", () => {
    // Ids repeat across mounts (one app each), so look up within the wrapper.
    const message = (w: VueWrapper) => {
      const id = input(w).attributes("aria-describedby");
      return id ? w.find(`[id="${id}"]`).text() : null;
    };
    async function enter(w: VueWrapper, text: string) {
      await input(w).setValue(text);
      await input(w).trigger("blur");
    }

    it("names the expected format with an example", async () => {
      const w = mountPicker({
        modelValue: "",
        displayFormat: "mmm d, yyyy",
        min: "2026-01-01",
      });
      expect(message(w)).toBeNull();
      await enter(w, "2026-05-14");
      expect(message(w)).toBe("Enter a date as mmm d, yyyy, like Jan 1, 2026");
      await enter(w, "May 14, 2026");
      expect(message(w)).toBeNull();
      expect(w.find(".cfasim-date-error").text()).toBe("");
    });

    it("names the allowed range", async () => {
      const both = mountPicker({ min: "2026-01-01", max: "2026-12-31" });
      await enter(both, "2027-01-01");
      expect(message(both)).toBe("Choose a date from 2026-01-01 to 2026-12-31");

      const min = mountPicker({ min: "2026-01-01" });
      await enter(min, "2025-12-31");
      expect(message(min)).toBe("Choose a date on or after 2026-01-01");

      const max = mountPicker({ max: "2026-12-31" });
      await enter(max, "2027-01-01");
      expect(message(max)).toBe("Choose a date on or before 2026-12-31");
    });

    it("asks for a date when a required field is emptied", async () => {
      const w = mountPicker({ modelValue: "2026-05-14", required: true });
      await enter(w, "");
      expect(message(w)).toBe("Enter a date");
    });

    it("explains a rejected model day", async () => {
      const w = mountPicker({
        modelValue: "2026-05-14",
        referenceDate: "2026-05-14",
        min: "2026-05-14",
      });
      await w.find('button[aria-label="Open calendar"]').trigger("click");
      await nextTick();
      const el = document.querySelector<HTMLInputElement>(
        'input[type="number"]',
      )!;
      const describedText = () =>
        el
          .getAttribute("aria-describedby")!
          .split(" ")
          .map((id) => document.getElementById(id)!.textContent!.trim())
          .join(" | ");
      el.value = "1.5";
      el.dispatchEvent(new Event("input"));
      el.dispatchEvent(new Event("change"));
      await nextTick();
      expect(describedText()).toBe(
        "Days from 2026-05-14 | Enter a whole number of days",
      );
      el.value = "-1";
      el.dispatchEvent(new Event("input"));
      el.dispatchEvent(new Event("change"));
      await nextTick();
      expect(describedText()).toBe(
        "Days from 2026-05-14 | Choose a date on or after 2026-05-14",
      );
    });
  });

  describe("displayFormat", () => {
    it("shows the value in the display format and emits in format", async () => {
      const w = mountPicker({
        modelValue: "2026-05-14",
        displayFormat: "mmm d, yyyy",
        min: "2026-01-01",
      });
      const el = input(w).element as HTMLInputElement;
      expect(el.value).toBe("May 14, 2026");
      expect(el.placeholder).toBe("mmm d, yyyy");

      await input(w).setValue("june 2, 2026");
      await input(w).trigger("blur");
      expect(w.props("modelValue")).toBe("2026-06-02");
      expect(el.value).toBe("Jun 2, 2026");

      // Input is parsed in the display format only, and min stays in `format`.
      await input(w).setValue("2026-07-01");
      await input(w).trigger("blur");
      expect(input(w).attributes("aria-invalid")).toBe("true");
      await input(w).setValue("Dec 31, 2025");
      await input(w).trigger("blur");
      expect(input(w).attributes("aria-invalid")).toBe("true");
      expect(w.props("modelValue")).toBe("2026-06-02");
    });

    it("emits calendar and model-day picks in format", async () => {
      const w = mountPicker({
        modelValue: "2026-05-14",
        displayFormat: "dd/mm/yyyy",
        referenceDate: "2026-05-01",
      });
      await w.find('button[aria-label="Open calendar"]').trigger("click");
      await nextTick();
      const day = document.querySelector<HTMLInputElement>(
        'input[type="number"]',
      )!;
      day.value = "3";
      day.dispatchEvent(new Event("input"));
      day.dispatchEvent(new Event("change"));
      await nextTick();
      expect(w.props("modelValue")).toBe("2026-05-04");
      expect((input(w).element as HTMLInputElement).value).toBe("04/05/2026");
    });
  });

  it("emits an empty string when cleared, unless required", async () => {
    const w = mountPicker({ modelValue: "2026-05-14" });
    await input(w).setValue("");
    await input(w).trigger("blur");
    expect(w.props("modelValue")).toBe("");

    const r = mountPicker({ modelValue: "2026-05-14", required: true });
    expect(input(r).attributes("aria-invalid")).toBeUndefined();
    await input(r).setValue("");
    await input(r).trigger("blur");
    expect(r.props("modelValue")).toBe("2026-05-14");
    expect(input(r).attributes("aria-invalid")).toBe("true");
  });

  it("shows a clear button when clearable and the field has a value", async () => {
    const w = mountPicker({ modelValue: "2026-05-14", clearable: true });
    const clear = w.find('button[aria-label="Clear Start date"]');
    expect(clear.exists()).toBe(true);
    await clear.trigger("click");
    expect(w.props("modelValue")).toBe("");
    expect(w.find('button[aria-label="Clear Start date"]').exists()).toBe(
      false,
    );
  });

  it("hides the clear button when required", () => {
    const w = mountPicker({
      modelValue: "2026-05-14",
      clearable: true,
      required: true,
    });
    expect(w.find('button[aria-label="Clear Start date"]').exists()).toBe(
      false,
    );
  });

  it("syncs when the model changes externally", async () => {
    const w = mountPicker({ modelValue: "2026-05-14" });
    await w.setProps({ modelValue: "2026-07-04" });
    expect((input(w).element as HTMLInputElement).value).toBe("2026-07-04");
  });

  it("selects a date from the calendar popover", async () => {
    const w = mountPicker({ modelValue: "2026-05-14" });
    await w.find('button[aria-label="Open calendar"]').trigger("click");
    await nextTick();
    const day = document.querySelector<HTMLElement>(
      '[data-reka-calendar-cell-trigger][data-value="2026-05-20"]',
    );
    expect(day).not.toBeNull();
    day!.click();
    await nextTick();
    expect(w.props("modelValue")).toBe("2026-05-20");
  });

  describe("month and year selects", () => {
    async function openCalendar(w: VueWrapper) {
      await w.find('button[aria-label="Open calendar"]').trigger("click");
      await nextTick();
    }
    const select = (name: "Month" | "Year") =>
      document.querySelector<HTMLSelectElement>(
        `select[aria-label="${name}"]`,
      )!;
    async function choose(name: "Month" | "Year", value: number) {
      const el = select(name);
      el.value = String(value);
      el.dispatchEvent(new Event("change"));
      await nextTick();
    }
    const shown = (value: string) =>
      document.querySelector(
        `[data-reka-calendar-cell-trigger][data-value="${value}"]:not([data-outside-view])`,
      );
    const options = (name: "Month" | "Year") =>
      [...select(name).options].map((o) => ({
        value: Number(o.value),
        disabled: o.disabled,
      }));

    it("shows the open month and year, with localized month names", async () => {
      const w = mountPicker({ modelValue: "2026-05-14", locale: "fr" });
      await openCalendar(w);
      expect(select("Month").value).toBe("5");
      expect(select("Year").value).toBe("2026");
      expect(select("Month").options[0].text).toBe("janvier");
    });

    it("moves the calendar without changing the value", async () => {
      const w = mountPicker({ modelValue: "2026-05-14" });
      await openCalendar(w);
      await choose("Month", 9);
      expect(shown("2026-09-14")).not.toBeNull();
      await choose("Year", 1990);
      expect(shown("1990-09-14")).not.toBeNull();
      expect(w.props("modelValue")).toBe("2026-05-14");
    });

    it("follows the prev/next arrows", async () => {
      const w = mountPicker({ modelValue: "2026-01-14" });
      await openCalendar(w);
      document
        .querySelector<HTMLElement>(`[aria-label="Previous page"]`)!
        .click();
      await nextTick();
      expect(select("Month").value).toBe("12");
      expect(select("Year").value).toBe("2025");
    });

    it("lists 50 years either side when unbounded", async () => {
      const w = mountPicker({ modelValue: "2026-05-14" });
      await openCalendar(w);
      const years = options("Year").map((o) => o.value);
      expect(years[0]).toBe(1976);
      expect(years.at(-1)).toBe(2076);
    });

    it("limits years and months to min/max and clamps a year change", async () => {
      const w = mountPicker({
        modelValue: "2025-06-10",
        min: "2024-03-15",
        max: "2026-08-01",
      });
      await openCalendar(w);
      expect(options("Year").map((o) => o.value)).toEqual([2024, 2025, 2026]);

      await choose("Year", 2024);
      expect(select("Month").value).toBe("6");
      const months = options("Month");
      expect(months.filter((m) => m.disabled).map((m) => m.value)).toEqual([
        1, 2,
      ]);

      await choose("Month", 11);
      await choose("Year", 2026);
      // November 2026 is past max, so the calendar stops at August.
      expect(select("Month").value).toBe("8");
      expect(shown("2026-08-01")).not.toBeNull();
    });

    it("opens inside min/max when the value is empty", async () => {
      const w = mountPicker({ modelValue: "", min: "2999-03-10" });
      await openCalendar(w);
      expect(select("Year").value).toBe("2999");
      expect(select("Month").value).toBe("3");
      const years = options("Year").map((o) => o.value);
      expect(years[0]).toBe(2999);
      expect(years.at(-1)).toBe(3049);
    });

    it("lists years up to max and disables later months", async () => {
      const w = mountPicker({ modelValue: "", max: "1901-04-02" });
      await openCalendar(w);
      expect(select("Year").value).toBe("1901");
      expect(select("Month").value).toBe("4");
      expect(options("Year").at(-1)!.value).toBe(1901);
      expect(
        options("Month")
          .filter((m) => m.disabled)
          .map((m) => m.value),
      ).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it("disables the arrows at the min and max months", async () => {
      const w = mountPicker({
        modelValue: "2026-05-14",
        min: "2026-05-01",
        max: "2026-05-31",
      });
      await openCalendar(w);
      for (const label of ["Previous page", "Next page"])
        expect(
          document
            .querySelector(`[aria-label="${label}"]`)!
            .hasAttribute("data-disabled"),
        ).toBe(true);
    });

    it("resets to the value's month when reopened", async () => {
      const w = mountPicker({ modelValue: "2026-05-14" });
      await openCalendar(w);
      await choose("Year", 2000);
      await w.find('button[aria-label="Open calendar"]').trigger("click");
      await nextTick();
      await openCalendar(w);
      expect(select("Year").value).toBe("2026");
    });
  });

  describe("referenceDate", () => {
    async function openCalendar(w: VueWrapper) {
      await w.find('button[aria-label="Open calendar"]').trigger("click");
      await nextTick();
    }
    const timeInput = () =>
      document.querySelector<HTMLInputElement>('input[type="number"]');
    const cell = (value: string) =>
      document.querySelector<HTMLElement>(
        `[data-reka-calendar-cell-trigger][data-value="${value}"]`,
      )!;

    it("has no model time field without a reference date", async () => {
      const w = mountPicker({ modelValue: "2026-05-14" });
      await openCalendar(w);
      expect(timeInput()).toBeNull();
    });

    it("shows the value as days from the reference date", async () => {
      const w = mountPicker({
        modelValue: "2026-05-24",
        referenceDate: "2026-05-14",
      });
      await openCalendar(w);
      expect(timeInput()!.value).toBe("10");
      expect(
        document.querySelector(".cfasim-calendar-time .HintTrigger"),
      ).not.toBeNull();
    });

    it("converts an entered day to a date", async () => {
      const w = mountPicker({
        modelValue: "",
        referenceDate: "05/14/2026",
        format: "mm/dd/yyyy",
        timeLabel: "Model day",
      });
      await openCalendar(w);
      const el = timeInput()!;
      expect(document.querySelector(`label[for="${el.id}"]`)!.textContent).toBe(
        "Model day",
      );
      el.value = "21";
      el.dispatchEvent(new Event("input"));
      el.dispatchEvent(new Event("change"));
      await nextTick();
      expect(w.props("modelValue")).toBe("06/04/2026");

      el.value = "-14";
      el.dispatchEvent(new Event("input"));
      el.dispatchEvent(new Event("change"));
      await nextTick();
      expect(w.props("modelValue")).toBe("04/30/2026");
    });

    it("rejects days outside min/max or that are not whole", async () => {
      const w = mountPicker({
        modelValue: "2026-05-14",
        referenceDate: "2026-05-14",
        min: "2026-05-14",
      });
      await openCalendar(w);
      const el = timeInput()!;
      for (const v of ["-1", "1.5"]) {
        el.value = v;
        el.dispatchEvent(new Event("input"));
        el.dispatchEvent(new Event("change"));
        await nextTick();
        expect(el.getAttribute("aria-invalid")).toBe("true");
        expect(el.value).toBe(v);
        expect(w.props("modelValue")).toBe("2026-05-14");
      }
    });

    it("marks the reference day instead of today", async () => {
      const w = mountPicker({
        modelValue: "2026-05-20",
        referenceDate: "2026-05-14",
      });
      await openCalendar(w);
      expect(cell("2026-05-14").hasAttribute("data-reference")).toBe(true);
      expect(cell("2026-05-20").hasAttribute("data-reference")).toBe(false);
      expect(document.querySelector("[data-mark-today]")).toBeNull();
    });

    it("describes the reference day and the day field for assistive tech", async () => {
      const w = mountPicker({
        modelValue: "2026-05-20",
        referenceDate: "2026-05-14",
      });
      await openCalendar(w);
      const text = (el: Element, attr = "aria-describedby") =>
        el
          .getAttribute(attr)!
          .split(" ")
          .map((id) => document.getElementById(id)!.textContent!.trim())
          .join(" | ");
      expect(text(cell("2026-05-14"))).toBe("Day 0");
      expect(cell("2026-05-20").hasAttribute("aria-describedby")).toBe(false);
      expect(text(timeInput()!)).toBe("Days from 2026-05-14 | ");
    });

    it("opens on the reference month when there is no value", async () => {
      const w = mountPicker({ modelValue: "", referenceDate: "2024-02-10" });
      await openCalendar(w);
      expect(cell("2024-02-10")).not.toBeNull();
    });

    it("opens on the value's month over the reference month", async () => {
      const w = mountPicker({
        modelValue: "2024-07-04",
        referenceDate: "2024-02-10",
      });
      await openCalendar(w);
      expect(cell("2024-07-04")).not.toBeNull();
      expect(document.querySelector('[data-value="2024-02-10"]')).toBeNull();
    });

    it("marks today when there is no reference date", async () => {
      const w = mountPicker({ modelValue: "2026-05-20" });
      await openCalendar(w);
      expect(document.querySelector("[data-reference]")).toBeNull();
      expect(cell("2026-05-20").hasAttribute("data-mark-today")).toBe(true);
    });
  });
});

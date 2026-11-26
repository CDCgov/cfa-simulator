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
  const mounted = mount(DatePicker, {
    attachTo: document.body,
    props: {
      label: "Start date",
      "onUpdate:modelValue": (value: string | undefined) =>
        mounted.setProps({ modelValue: value }),
      ...props,
    },
  });
  wrapper = mounted;
  return mounted;
}

const inputOf = (mounted: VueWrapper) => mounted.find("input");

async function openCalendar(mounted: VueWrapper) {
  await mounted.find('button[aria-label="Open calendar"]').trigger("click");
  await nextTick();
}

describe("DatePicker", () => {
  it("commits on blur and Enter, normalizing to format", async () => {
    const mounted = mountPicker({ modelValue: "" });
    await inputOf(mounted).setValue("2026-5-4");
    expect(mounted.props("modelValue")).toBe("");
    await inputOf(mounted).trigger("blur");
    expect(mounted.props("modelValue")).toBe("2026-05-04");

    const custom = mountPicker({
      modelValue: "01/02/2026",
      format: "mm/dd/yyyy",
    });
    await inputOf(custom).setValue("12/25/2026");
    await inputOf(custom).trigger("keydown.enter");
    expect(custom.props("modelValue")).toBe("12/25/2026");
  });

  it("validates format, min/max bounds, and required without emitting invalid values", async () => {
    const mounted = mountPicker({
      modelValue: "2026-05-14",
      min: "2026-01-01",
      max: "2026-12-31",
      required: true,
    });
    const errorMessage = () => {
      const id = inputOf(mounted).attributes("aria-describedby");
      return id ? mounted.find(`[id="${id}"]`).text() : null;
    };

    await inputOf(mounted).setValue("not a date");
    await inputOf(mounted).trigger("blur");
    expect(inputOf(mounted).attributes("aria-invalid")).toBe("true");
    expect(mounted.props("modelValue")).toBe("2026-05-14");

    await inputOf(mounted).setValue("2027-01-01");
    await inputOf(mounted).trigger("blur");
    expect(errorMessage()).toBe("Choose a date from 2026-01-01 to 2026-12-31");

    await inputOf(mounted).setValue("");
    await inputOf(mounted).trigger("blur");
    expect(errorMessage()).toBe("Enter a date");

    await inputOf(mounted).setValue("2026-06-01");
    await inputOf(mounted).trigger("blur");
    expect(inputOf(mounted).attributes("aria-invalid")).toBeUndefined();
    expect(mounted.props("modelValue")).toBe("2026-06-01");
  });

  it("separates displayFormat from model format and min bounds", async () => {
    const mounted = mountPicker({
      modelValue: "2026-05-14",
      displayFormat: "mmm d, yyyy",
      min: "2026-01-01",
    });
    const element = inputOf(mounted).element as HTMLInputElement;
    expect(element.value).toBe("May 14, 2026");

    await inputOf(mounted).setValue("june 2, 2026");
    await inputOf(mounted).trigger("blur");
    expect(mounted.props("modelValue")).toBe("2026-06-02");
    expect(element.value).toBe("Jun 2, 2026");

    await inputOf(mounted).setValue("2026-07-01");
    await inputOf(mounted).trigger("blur");
    expect(inputOf(mounted).attributes("aria-invalid")).toBe("true");
  });

  it("selects a date from the calendar and clamps month/year selects to min/max", async () => {
    const mounted = mountPicker({
      modelValue: "2025-06-10",
      min: "2024-03-15",
      max: "2026-08-01",
    });
    await openCalendar(mounted);

    const monthSelect = document.querySelector<HTMLSelectElement>(
      'select[aria-label="Month"]',
    )!;
    const yearSelect = document.querySelector<HTMLSelectElement>(
      'select[aria-label="Year"]',
    )!;
    expect(
      [...yearSelect.options].map((option) => Number(option.value)),
    ).toEqual([2024, 2025, 2026]);

    monthSelect.value = "11";
    monthSelect.dispatchEvent(new Event("change"));
    await nextTick();
    yearSelect.value = "2026";
    yearSelect.dispatchEvent(new Event("change"));
    await nextTick();
    expect(monthSelect.value).toBe("8");

    document
      .querySelector<HTMLElement>(
        '[data-reka-calendar-cell-trigger][data-value="2026-08-01"]',
      )!
      .click();
    await nextTick();
    expect(mounted.props("modelValue")).toBe("2026-08-01");
  });

  it("converts referenceDate day offsets and rejects non-whole or out-of-range days", async () => {
    const mounted = mountPicker({
      modelValue: "2026-05-24",
      referenceDate: "2026-05-14",
      min: "2026-05-14",
    });
    await openCalendar(mounted);

    const dayInput = document.querySelector<HTMLInputElement>(
      'input[type="number"]',
    )!;
    expect(dayInput.value).toBe("10");

    dayInput.value = "21";
    dayInput.dispatchEvent(new Event("input"));
    dayInput.dispatchEvent(new Event("change"));
    await nextTick();
    expect(mounted.props("modelValue")).toBe("2026-06-04");

    for (const invalid of ["-1", "1.5"]) {
      dayInput.value = invalid;
      dayInput.dispatchEvent(new Event("input"));
      dayInput.dispatchEvent(new Event("change"));
      await nextTick();
      expect(dayInput.getAttribute("aria-invalid")).toBe("true");
      expect(mounted.props("modelValue")).toBe("2026-06-04");
    }
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import DateRangePicker from "./DateRangePicker.vue";

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

function mountPicker(props: Record<string, unknown> = {}) {
  const w = mount(DateRangePicker, {
    attachTo: document.body,
    props: {
      label: "Window",
      "onUpdate:start": (v: string | undefined) => w.setProps({ start: v }),
      "onUpdate:end": (v: string | undefined) => w.setProps({ end: v }),
      ...props,
    },
  });
  wrapper = w;
  return w;
}

const startInput = (w: VueWrapper) => w.findAll("input")[0];
const endInput = (w: VueWrapper) => w.findAll("input")[1];
const value = (el: ReturnType<typeof startInput>) =>
  (el.element as HTMLInputElement).value;
const errorText = (w: VueWrapper) => w.find(".cfasim-date-error").text();

describe("DateRangePicker", () => {
  it("shows both values and names the inputs and group", () => {
    const w = mountPicker({ start: "2026-05-14", end: "2026-06-30" });
    expect(value(startInput(w))).toBe("2026-05-14");
    expect(value(endInput(w))).toBe("2026-06-30");
    expect(startInput(w).attributes("aria-label")).toBe("Start date");
    expect(endInput(w).attributes("aria-label")).toBe("End date");
    const group = w.find('[role="group"]');
    const labelId = group.attributes("aria-labelledby");
    expect(w.find(`[id="${labelId}"]`).text()).toContain("Window");
  });

  it("splits with a divider by default, and uses a dash inline", async () => {
    const w = mountPicker({ start: "2026-05-14", end: "2026-06-30" });
    expect(w.find("[data-layout='split']").exists()).toBe(true);
    expect(w.find(".date-range-picker-divider").exists()).toBe(true);
    expect(w.find(".date-range-picker-separator").exists()).toBe(false);
    await w.setProps({ layout: "inline" });
    expect(w.find(".date-range-picker-separator").text()).toBe("–");
    expect(w.find(".date-range-picker-divider").exists()).toBe(false);
    await w.setProps({ separator: "to" });
    expect(w.find(".date-range-picker-separator").text()).toBe("to");
  });

  it("commits each end on blur, normalized to the format", async () => {
    const w = mountPicker({ start: "", end: "" });
    await startInput(w).setValue("2026-5-4");
    await startInput(w).trigger("blur");
    expect(w.props("start")).toBe("2026-05-04");
    expect(value(startInput(w))).toBe("2026-05-04");
    expect(w.props("end")).toBe("");

    await endInput(w).setValue("2026-6-1");
    await endInput(w).trigger("keydown.enter");
    expect(w.props("end")).toBe("2026-06-01");
  });

  it("uses the display format for the inputs and format for the model", async () => {
    const w = mountPicker({
      start: "2026-05-14",
      end: "2026-06-30",
      displayFormat: "mmm d, yyyy",
    });
    expect(value(startInput(w))).toBe("May 14, 2026");
    await endInput(w).setValue("jul 4, 2026");
    await endInput(w).trigger("blur");
    expect(w.props("end")).toBe("2026-07-04");
    expect(value(endInput(w))).toBe("Jul 4, 2026");
  });

  it("rejects an end before the start, and a start after the end", async () => {
    const w = mountPicker({ start: "2026-05-14", end: "2026-06-30" });
    await endInput(w).setValue("2026-05-01");
    await endInput(w).trigger("blur");
    expect(endInput(w).attributes("aria-invalid")).toBe("true");
    expect(errorText(w)).toMatch(/on or after the start/);
    expect(w.props("end")).toBe("2026-06-30");

    await startInput(w).setValue("2026-07-01");
    await startInput(w).trigger("blur");
    expect(startInput(w).attributes("aria-invalid")).toBe("true");
    expect(w.props("start")).toBe("2026-05-14");

    // A same-day range is allowed.
    await startInput(w).setValue("2026-06-30");
    await startInput(w).trigger("blur");
    expect(startInput(w).attributes("aria-invalid")).toBeUndefined();
    expect(w.props("start")).toBe("2026-06-30");
  });

  it("flags out-of-bounds and unparseable input without emitting", async () => {
    const w = mountPicker({
      start: "2026-06-01",
      end: "2026-06-14",
      min: "2026-05-14",
      max: "2026-08-31",
    });
    await startInput(w).setValue("2026-01-01");
    await startInput(w).trigger("blur");
    expect(errorText(w)).toBe("Choose dates from 2026-05-14 to 2026-08-31");
    const describedBy = startInput(w).attributes("aria-describedby");
    expect(w.find(`[id="${describedBy}"]`).text()).toBe(
      "Choose dates from 2026-05-14 to 2026-08-31",
    );
    expect(w.props("start")).toBe("2026-06-01");

    await endInput(w).setValue("nope");
    await endInput(w).trigger("blur");
    expect(endInput(w).attributes("aria-invalid")).toBe("true");
    expect(w.props("end")).toBe("2026-06-14");
  });

  it("keeps a rejected end's text and commits it once the other end allows it", async () => {
    const w = mountPicker({ start: "2026-05-14", end: "2026-06-30" });
    await startInput(w).setValue("2026-07-10");
    await startInput(w).trigger("blur");
    expect(w.props("start")).toBe("2026-05-14");
    expect(startInput(w).attributes("aria-invalid")).toBe("true");

    await endInput(w).setValue("2026-07-31");
    await endInput(w).trigger("blur");
    await nextTick();
    expect(w.props("end")).toBe("2026-07-31");
    expect(w.props("start")).toBe("2026-07-10");
    expect(value(startInput(w))).toBe("2026-07-10");
    expect(startInput(w).attributes("aria-invalid")).toBeUndefined();
  });

  it("keeps rejected text that is still invalid when the other end changes", async () => {
    const w = mountPicker({ start: "2026-05-14", end: "2026-06-30" });
    await startInput(w).setValue("not a date");
    await startInput(w).trigger("blur");
    await endInput(w).setValue("2026-07-31");
    await endInput(w).trigger("blur");
    await nextTick();
    expect(value(startInput(w))).toBe("not a date");
    expect(startInput(w).attributes("aria-invalid")).toBe("true");
    expect(w.props("start")).toBe("2026-05-14");
  });

  it("clears the end's order error when the start moves before it", async () => {
    const w = mountPicker({ start: "2026-06-30", end: "2026-05-01" });
    expect(endInput(w).attributes("aria-invalid")).toBe("true");
    await startInput(w).setValue("2026-04-01");
    await startInput(w).trigger("blur");
    await nextTick();
    expect(w.props("start")).toBe("2026-04-01");
    expect(endInput(w).attributes("aria-invalid")).toBeUndefined();
  });

  it("describes each input with its own message", async () => {
    const w = mountPicker({
      start: "2026-05-14",
      end: "2026-06-30",
      min: "2026-05-01",
      max: "2026-08-31",
    });
    await endInput(w).setValue("2026-05-02");
    await endInput(w).trigger("blur");
    await startInput(w).setValue("2026-01-01");
    await startInput(w).trigger("blur");
    const message = (input: ReturnType<typeof startInput>) =>
      w.find(`[id="${input.attributes("aria-describedby")}"]`).text();
    expect(message(startInput(w))).toBe(
      "Choose dates from 2026-05-01 to 2026-08-31",
    );
    expect(message(endInput(w))).toMatch(/on or after the start/);
    expect(errorText(w)).toContain("on or after the start");
  });

  it("flags a model pair that is out of order on the end input", () => {
    const w = mountPicker({ start: "2026-06-30", end: "2026-05-01" });
    expect(startInput(w).attributes("aria-invalid")).toBeUndefined();
    expect(endInput(w).attributes("aria-invalid")).toBe("true");
  });

  it("clears an emptied field unless required", async () => {
    const w = mountPicker({ start: "2026-05-14", end: "2026-06-30" });
    await endInput(w).setValue("");
    await endInput(w).trigger("blur");
    expect(w.props("end")).toBe("");

    await w.setProps({ required: true });
    await startInput(w).setValue("");
    await startInput(w).trigger("blur");
    expect(errorText(w)).toBe("Enter a start date");
    expect(w.props("start")).toBe("2026-05-14");
  });

  it("clears both ends with the clear button", async () => {
    const w = mountPicker({
      start: "2026-05-14",
      end: "2026-06-30",
      clearable: true,
    });
    await w.find('button[aria-label="Clear Window"]').trigger("click");
    expect(w.props("start")).toBe("");
    expect(w.props("end")).toBe("");
    expect(w.find('button[aria-label="Clear Window"]').exists()).toBe(false);
  });

  it("hides the clear button when required", () => {
    const w = mountPicker({
      start: "2026-05-14",
      end: "2026-06-30",
      clearable: true,
      required: true,
    });
    expect(w.find('button[aria-label="Clear Window"]').exists()).toBe(false);
  });

  it("picks a range in the calendar and closes it", async () => {
    const w = mountPicker({ start: "2026-05-14", end: "2026-05-20" });
    await w.find('button[aria-label="Open calendar"]').trigger("click");
    await nextTick();
    const day = (iso: string) =>
      document.querySelector<HTMLElement>(`[data-value="${iso}"]`)!;
    expect(day("2026-05-14").hasAttribute("data-selection-start")).toBe(true);
    expect(day("2026-05-17").hasAttribute("data-selected")).toBe(true);

    day("2026-05-03").click();
    await nextTick();
    // A half range is not emitted.
    expect(w.props("start")).toBe("2026-05-14");
    expect(document.querySelector(".cfasim-date-picker-content")).not.toBe(
      null,
    );

    day("2026-05-09").click();
    await nextTick();
    expect(w.props("start")).toBe("2026-05-03");
    expect(w.props("end")).toBe("2026-05-09");
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector(".cfasim-date-picker-content")).toBe(null);
  });

  it("opens the calendar on the start month and moves with the selects", async () => {
    const w = mountPicker({ start: "2026-02-10", end: "2026-03-05" });
    await w.find('button[aria-label="Open calendar"]').trigger("click");
    await nextTick();
    const month = document.querySelector<HTMLSelectElement>(
      'select[aria-label="Month"]',
    )!;
    expect(month.value).toBe("2");
    const year = document.querySelector<HTMLSelectElement>(
      'select[aria-label="Year"]',
    )!;
    year.value = "2030";
    year.dispatchEvent(new Event("change"));
    await nextTick();
    expect(document.querySelector('[data-value="2030-02-14"]')).not.toBe(null);
  });
});

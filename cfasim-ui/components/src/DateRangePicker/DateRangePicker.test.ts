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
  const mounted = mount(DateRangePicker, {
    attachTo: document.body,
    props: {
      label: "Window",
      "onUpdate:start": (value: string | undefined) =>
        mounted.setProps({ start: value }),
      "onUpdate:end": (value: string | undefined) =>
        mounted.setProps({ end: value }),
      ...props,
    },
  });
  wrapper = mounted;
  return mounted;
}

const startInput = (mounted: VueWrapper) => mounted.findAll("input")[0];
const endInput = (mounted: VueWrapper) => mounted.findAll("input")[1];
const errorText = (mounted: VueWrapper) =>
  mounted.find(".cfasim-date-error").text();

describe("DateRangePicker", () => {
  it("commits normalized dates on blur/Enter and supports displayFormat", async () => {
    const mounted = mountPicker({
      start: "2026-05-14",
      end: "",
      displayFormat: "mmm d, yyyy",
    });
    expect((startInput(mounted).element as HTMLInputElement).value).toBe(
      "May 14, 2026",
    );
    await endInput(mounted).setValue("jul 4, 2026");
    await endInput(mounted).trigger("keydown.enter");
    expect(mounted.props("end")).toBe("2026-07-04");
    expect((endInput(mounted).element as HTMLInputElement).value).toBe(
      "Jul 4, 2026",
    );
  });

  it("enforces start <= end, allowing same-day and committing pending text once valid", async () => {
    const mounted = mountPicker({ start: "2026-05-14", end: "2026-06-30" });
    await endInput(mounted).setValue("2026-05-01");
    await endInput(mounted).trigger("blur");
    expect(endInput(mounted).attributes("aria-invalid")).toBe("true");
    expect(errorText(mounted)).toMatch(/on or after the start/);
    expect(mounted.props("end")).toBe("2026-06-30");

    await endInput(mounted).setValue("2026-05-14");
    await endInput(mounted).trigger("blur");
    expect(mounted.props("end")).toBe("2026-05-14");

    // Rejected start text is retained and commits once end moves past it.
    await startInput(mounted).setValue("2026-07-10");
    await startInput(mounted).trigger("blur");
    expect(startInput(mounted).attributes("aria-invalid")).toBe("true");
    await endInput(mounted).setValue("2026-07-31");
    await endInput(mounted).trigger("blur");
    await nextTick();
    expect(mounted.props("start")).toBe("2026-07-10");
    expect(mounted.props("end")).toBe("2026-07-31");
  });

  it("validates min/max bounds and required", async () => {
    const mounted = mountPicker({
      start: "2026-06-01",
      end: "2026-06-14",
      min: "2026-05-14",
      max: "2026-08-31",
      required: true,
    });
    await startInput(mounted).setValue("2026-01-01");
    await startInput(mounted).trigger("blur");
    expect(errorText(mounted)).toBe(
      "Choose dates from 2026-05-14 to 2026-08-31",
    );

    await startInput(mounted).setValue("");
    await startInput(mounted).trigger("blur");
    expect(errorText(mounted)).toBe("Enter a start date");
    expect(mounted.props("start")).toBe("2026-06-01");
  });

  it("picks a complete range in the calendar without emitting half ranges", async () => {
    const mounted = mountPicker({ start: "2026-05-14", end: "2026-05-20" });
    await mounted.find('button[aria-label="Open calendar"]').trigger("click");
    await nextTick();
    const day = (iso: string) =>
      document.querySelector<HTMLElement>(`[data-value="${iso}"]`)!;

    day("2026-05-03").click();
    await nextTick();
    expect(mounted.props("start")).toBe("2026-05-14");

    day("2026-05-09").click();
    await nextTick();
    expect(mounted.props("start")).toBe("2026-05-03");
    expect(mounted.props("end")).toBe("2026-05-09");
  });
});

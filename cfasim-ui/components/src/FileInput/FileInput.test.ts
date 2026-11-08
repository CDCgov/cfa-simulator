import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import FileInput from "./FileInput.vue";
import { acceptsFile } from "./accept";

const csv = new File(["a,b\n1,2"], "data.csv", { type: "text/csv" });
const png = new File(["x"], "pic.png", { type: "image/png" });

function mountControlled(props: Record<string, unknown> = {}) {
  const wrapper = mount(FileInput, {
    props: {
      label: "Upload",
      modelValue: null,
      "onUpdate:modelValue": (v: File | File[] | null | undefined) =>
        wrapper.setProps({ modelValue: v }),
      ...props,
    },
  });
  return wrapper;
}

async function pick(
  wrapper: ReturnType<typeof mountControlled>,
  files: File[],
) {
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, "files", {
    value: files,
    configurable: true,
  });
  await input.trigger("change");
}

function fileName(wrapper: ReturnType<typeof mountControlled>) {
  return (wrapper.props("modelValue") as File | null)?.name;
}

function drop(wrapper: ReturnType<typeof mountControlled>, files: File[]) {
  return wrapper
    .find(".file-input")
    .trigger("drop", { dataTransfer: { files } });
}

describe("acceptsFile", () => {
  it("matches extensions, exact types and wildcards", () => {
    expect(acceptsFile(csv, undefined)).toBe(true);
    expect(acceptsFile(csv, ".csv")).toBe(true);
    expect(acceptsFile(csv, ".CSV, .json")).toBe(true);
    expect(acceptsFile(csv, "text/csv")).toBe(true);
    expect(acceptsFile(png, "image/*")).toBe(true);
    expect(acceptsFile(png, ".csv,text/csv")).toBe(false);
  });
});

describe("FileInput", () => {
  it("names the button by the label plus its text and hides the native input", () => {
    const wrapper = mount(FileInput, { props: { label: "Upload" } });
    const button = wrapper.find(".file-input-button");
    const label = wrapper.find(".file-input-label");
    expect(label.element.tagName).toBe("SPAN");
    expect(button.attributes("aria-labelledby")).toBe(
      `${label.attributes("id")} ${button.attributes("id")}`,
    );
    expect(button.text()).toBe("Choose file");
    expect(wrapper.find(".file-input-summary").text()).toBe("No file chosen");
    const native = wrapper.find('input[type="file"]');
    expect(native.attributes("tabindex")).toBe("-1");
    expect(native.attributes("aria-hidden")).toBe("true");
  });

  it("emits a single File, shows its name and clears", async () => {
    const wrapper = mountControlled({ accept: ".csv" });
    expect(wrapper.find('input[type="file"]').attributes("accept")).toBe(
      ".csv",
    );
    await pick(wrapper, [csv]);
    // test-utils hands props back through a reactive proxy, so compare names.
    expect(fileName(wrapper)).toBe("data.csv");
    expect(wrapper.find(".file-input-summary").text()).toBe("data.csv");
    await wrapper.find(".file-input-clear").trigger("click");
    expect(wrapper.props("modelValue")).toBeNull();
    expect(wrapper.find(".file-input-clear").exists()).toBe(false);
  });

  it("emits a File[] in multiple mode and summarizes more than two", async () => {
    const wrapper = mountControlled({ multiple: true, modelValue: [] });
    expect(wrapper.find(".file-input-button").text()).toBe("Choose files");
    await pick(wrapper, [csv, png]);
    expect((wrapper.props("modelValue") as File[]).map((f) => f.name)).toEqual([
      "data.csv",
      "pic.png",
    ]);
    expect(wrapper.find(".file-input-summary").text()).toBe(
      "data.csv, pic.png",
    );
    await pick(wrapper, [csv, png, csv]);
    expect(wrapper.find(".file-input-summary").text()).toBe("3 files");
    await wrapper.find(".file-input-clear").trigger("click");
    expect(wrapper.props("modelValue")).toEqual([]);
  });

  it("accepts dropped files that match accept and reports the rest", async () => {
    const wrapper = mountControlled({ accept: ".csv" });
    await drop(wrapper, [png]);
    expect(wrapper.props("modelValue")).toBeNull();
    expect(wrapper.emitted("rejected")?.[0]).toEqual([[png]]);
    const error = wrapper.find(".file-input-error");
    expect(error.text()).toBe("pic.png is not an accepted file type");
    expect(
      wrapper.find(".file-input-button").attributes("aria-describedby"),
    ).toBe(error.attributes("id"));

    await drop(wrapper, [csv]);
    expect(fileName(wrapper)).toBe("data.csv");
    expect(wrapper.find(".file-input-error").exists()).toBe(false);
  });

  it("ignores drops when disabled or with dropzone off", async () => {
    const disabled = mountControlled({ disabled: true });
    await drop(disabled, [csv]);
    expect(disabled.props("modelValue")).toBeNull();
    expect(
      disabled.find(".file-input-button").attributes("disabled"),
    ).toBeDefined();

    const noDrop = mountControlled({ dropzone: false });
    await drop(noDrop, [csv]);
    expect(noDrop.props("modelValue")).toBeNull();
  });
});

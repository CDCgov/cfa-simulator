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
      "onUpdate:modelValue": (value: File | File[] | null | undefined) =>
        wrapper.setProps({ modelValue: value }),
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

describe("FileInput", () => {
  it("matches extensions, exact types, and wildcards in acceptsFile", () => {
    expect(acceptsFile(csv, undefined)).toBe(true);
    expect(acceptsFile(csv, ".CSV, .json")).toBe(true);
    expect(acceptsFile(csv, "text/csv")).toBe(true);
    expect(acceptsFile(png, "image/*")).toBe(true);
    expect(acceptsFile(png, ".csv,text/csv")).toBe(false);
  });

  it("picks and clears single and multiple files with summary formatting", async () => {
    const single = mountControlled({ accept: ".csv" });
    await pick(single, [csv]);
    expect((single.props("modelValue") as File | null)?.name).toBe("data.csv");
    await single.find(".file-input-clear").trigger("click");
    expect(single.props("modelValue")).toBeNull();

    const multi = mountControlled({ multiple: true, modelValue: [] });
    await pick(multi, [csv, png, csv]);
    expect(multi.find(".file-input-summary").text()).toBe("3 files");
    await multi.find(".file-input-clear").trigger("click");
    expect(multi.props("modelValue")).toEqual([]);
  });

  it("filters dropped files by accept and ignores drops when dropzone is off", async () => {
    const wrapper = mountControlled({ accept: ".csv" });
    await wrapper
      .find(".file-input")
      .trigger("drop", { dataTransfer: { files: [png] } });
    expect(wrapper.props("modelValue")).toBeNull();
    expect(wrapper.emitted("rejected")?.[0]).toEqual([[png]]);
    expect(wrapper.find(".file-input-error").text()).toContain("pic.png");

    await wrapper
      .find(".file-input")
      .trigger("drop", { dataTransfer: { files: [csv] } });
    expect((wrapper.props("modelValue") as File | null)?.name).toBe("data.csv");
    expect(wrapper.find(".file-input-error").exists()).toBe(false);

    const noDrop = mountControlled({ dropzone: false });
    await noDrop
      .find(".file-input")
      .trigger("drop", { dataTransfer: { files: [csv] } });
    expect(noDrop.props("modelValue")).toBeNull();
  });
});

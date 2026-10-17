import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import PriorInput from "./PriorInput.vue";
import SelectBox from "../SelectBox/SelectBox.vue";
import NumberInput from "../NumberInput/NumberInput.vue";
import type { PriorSpec } from "./distributions";

const normal: PriorSpec = { family: "Normal", params: { loc: 0, scale: 1 } };

// PriorPreview is an async component; wait for it to resolve and render.
async function settlePreview() {
  await import("./PriorPreview.vue");
  await flushPromises();
}

function lastEmitted(wrapper: ReturnType<typeof mount>): PriorSpec {
  const events = wrapper.emitted("update:modelValue")!;
  return events[events.length - 1][0] as PriorSpec;
}

describe("PriorInput", () => {
  it("renders the label and names the group with it", () => {
    const wrapper = mount(PriorInput, {
      props: { label: "R0 prior", modelValue: normal },
    });
    const label = wrapper.find(".prior-label");
    expect(label.text()).toContain("R0 prior");
    const group = wrapper.find('[role="group"]');
    expect(group.attributes("aria-labelledby")).toBe(label.attributes("id"));
  });

  it("visually hides the label when hideLabel is set", () => {
    const wrapper = mount(PriorInput, {
      props: { label: "R0 prior", hideLabel: true, modelValue: normal },
    });
    expect(wrapper.find(".prior-label").classes()).toContain("visually-hidden");
  });

  it("falls back to ariaLabel without a visible label", () => {
    const wrapper = mount(PriorInput, {
      props: { ariaLabel: "R0 prior", modelValue: normal },
    });
    expect(wrapper.find(".prior-label").exists()).toBe(false);
    expect(wrapper.find('[role="group"]').attributes("aria-label")).toBe(
      "R0 prior",
    );
  });

  it("emits the first family's default when mounted without a model", () => {
    const wrapper = mount(PriorInput);
    expect(lastEmitted(wrapper)).toEqual(normal);
  });

  it("switches family and resets params to that family's defaults", async () => {
    const wrapper = mount(PriorInput, { props: { modelValue: normal } });
    wrapper.findComponent(SelectBox).vm.$emit("update:modelValue", "Gamma");
    await wrapper.vm.$nextTick();
    expect(lastEmitted(wrapper)).toEqual({
      family: "Gamma",
      params: { concentration: 2, rate: 1 },
    });
  });

  it("carries same-named params across a family switch", async () => {
    const wrapper = mount(PriorInput, {
      props: { modelValue: { family: "Normal", params: { loc: 2, scale: 5 } } },
    });
    wrapper.findComponent(SelectBox).vm.$emit("update:modelValue", "StudentT");
    await wrapper.vm.$nextTick();
    expect(lastEmitted(wrapper)).toEqual({
      family: "StudentT",
      params: { df: 3, loc: 2, scale: 5 },
    });
  });

  it("renders one labeled NumberInput per param", () => {
    const wrapper = mount(PriorInput, {
      props: {
        modelValue: {
          family: "TruncatedNormal",
          params: { loc: 0, scale: 1, low: -2, high: 2 },
        },
      },
    });
    const inputs = wrapper.findAllComponents(NumberInput);
    expect(inputs.map((i) => i.props("label"))).toEqual([
      "loc",
      "scale",
      "low",
      "high",
    ]);
    expect(inputs[1].props("min")).toBe(0);
    expect(inputs[0].props("min")).toBeUndefined();
  });

  it("restricts the family options with `families`", () => {
    const wrapper = mount(PriorInput, {
      props: {
        modelValue: normal,
        families: ["HalfNormal", "Normal", "LogNormal"],
      },
    });
    const options = wrapper.findComponent(SelectBox).props("options");
    expect(options.map((o: { value: string }) => o.value)).toEqual([
      "HalfNormal",
      "Normal",
      "LogNormal",
    ]);
  });

  it("defaults to the first allowed family when mounted without a model", () => {
    const wrapper = mount(PriorInput, {
      props: { families: ["Gamma", "Normal"] },
    });
    expect(lastEmitted(wrapper).family).toBe("Gamma");
  });

  it("emits a new object on a param edit without mutating the prop", async () => {
    const original: PriorSpec = {
      family: "Normal",
      params: { loc: 0, scale: 1 },
    };
    const wrapper = mount(PriorInput, { props: { modelValue: original } });
    const scale = wrapper.findAllComponents(NumberInput)[1];
    scale.vm.$emit("update:modelValue", 2.5);
    await wrapper.vm.$nextTick();
    const next = lastEmitted(wrapper);
    expect(next).toEqual({ family: "Normal", params: { loc: 0, scale: 2.5 } });
    expect(next).not.toBe(original);
    expect(original.params.scale).toBe(1);
  });

  it("ignores an undefined param value", async () => {
    const wrapper = mount(PriorInput, { props: { modelValue: normal } });
    wrapper
      .findAllComponents(NumberInput)[0]
      .vm.$emit("update:modelValue", undefined);
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("renders a density sparkline with `preview`", async () => {
    const wrapper = mount(PriorInput, {
      props: { modelValue: normal, preview: true },
    });
    await settlePreview();
    const svg = wrapper.find("svg.prior-preview");
    expect(svg.exists()).toBe(true);
    expect(svg.attributes("role")).toBe("img");
    expect(svg.attributes("aria-label")).toBe("Normal(loc = 0, scale = 1)");
    expect(svg.findAll("path").length).toBe(2);
  });

  it("renders nothing for a preview with a degenerate scale", async () => {
    const wrapper = mount(PriorInput, {
      props: {
        modelValue: { family: "Normal", params: { loc: 0, scale: 0 } },
        preview: true,
      },
    });
    await settlePreview();
    expect(wrapper.find("svg.prior-preview").exists()).toBe(false);
  });

  it("renders the summary text", () => {
    const wrapper = mount(PriorInput, {
      props: { modelValue: normal, summary: true },
    });
    expect(wrapper.find(".prior-summary").text()).toBe(
      "Normal(loc = 0, scale = 1)",
    );
  });

  it("accepts custom distributions", () => {
    const wrapper = mount(PriorInput, {
      props: {
        distributions: [
          {
            family: "Exponential",
            label: "Exp",
            params: [{ name: "rate", default: 4, min: 0 }],
          },
        ],
      },
    });
    expect(lastEmitted(wrapper)).toEqual({
      family: "Exponential",
      params: { rate: 4 },
    });
    // The label is the dropdown value, so parameterizations can share a family.
    expect(wrapper.findComponent(SelectBox).props("options")).toEqual([
      { value: "Exp", label: "Exp" },
    ]);
  });

  it("offers a family in several parameterizations and shows the loaded one", async () => {
    // No labels: the component appends the parameter names to tell them apart.
    const distributions = [
      { family: "Exponential", params: [{ name: "rate", default: 1, min: 0 }] },
      {
        family: "Exponential",
        params: [{ name: "scale", default: 1, min: 0 }],
      },
    ];
    const wrapper = mount(PriorInput, {
      props: {
        distributions,
        families: ["Exponential"],
        modelValue: { family: "Exponential", params: { scale: 2 } },
      },
    });
    const select = wrapper.findComponent(SelectBox);
    expect(
      select.props("options").map((o: { value: string }) => o.value),
    ).toEqual(["Exponential (rate)", "Exponential (scale)"]);
    expect(select.props("modelValue")).toBe("Exponential (scale)");
    expect(
      wrapper.findAllComponents(NumberInput).map((i) => i.props("label")),
    ).toEqual(["scale"]);
    select.vm.$emit("update:modelValue", "Exponential (rate)");
    await wrapper.vm.$nextTick();
    expect(lastEmitted(wrapper)).toEqual({
      family: "Exponential",
      params: { rate: 1 },
    });
  });

  it("renders an integer param as a whole-number field", () => {
    const wrapper = mount(PriorInput, {
      props: {
        distributions: [
          {
            family: "Binomial",
            params: [
              { name: "n", default: 10, min: 0, integer: true },
              { name: "p", default: 0.5, min: 0, max: 1, step: 0.05 },
            ],
          },
        ],
        modelValue: { family: "Binomial", params: { n: 10, p: 0.5 } },
      },
    });
    const [n, p] = wrapper.findAllComponents(NumberInput);
    expect(n.props("numberType")).toBe("integer");
    expect(n.props("step")).toBe(1);
    expect(n.props("decimals")).toBe(0);
    expect(wrapper.findAll("input")[0].element.value).toBe("10");
    expect(wrapper.findAll("input")[0].attributes("inputmode")).toBe("numeric");
    expect(p.props("numberType")).toBe("float");
    expect(p.props("step")).toBe(0.05);
  });

  it("shows every decimal of the current value, at least two", () => {
    const wrapper = mount(PriorInput, {
      props: {
        label: "Prior",
        modelValue: { family: "Normal", params: { loc: 1.0533, scale: 1 } },
      },
    });
    const inputs = wrapper.findAllComponents(NumberInput);
    expect(inputs[0].props("decimals")).toBe(4);
    expect(inputs[1].props("decimals")).toBe(2);
  });
});

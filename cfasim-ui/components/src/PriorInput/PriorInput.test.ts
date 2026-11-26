import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import PriorInput from "./PriorInput.vue";
import SelectBox from "../SelectBox/SelectBox.vue";
import NumberInput from "../NumberInput/NumberInput.vue";
import type { PriorSpec } from "./distributions";

const normal: PriorSpec = { family: "Normal", params: { loc: 0, scale: 1 } };

function lastEmitted(wrapper: ReturnType<typeof mount>): PriorSpec {
  const events = wrapper.emitted("update:modelValue")!;
  return events[events.length - 1][0] as PriorSpec;
}

describe("PriorInput", () => {
  it("defaults to the first allowed family and carries shared params across switches", async () => {
    const initial = mount(PriorInput, {
      props: { families: ["Gamma", "Normal"] },
    });
    expect(lastEmitted(initial).family).toBe("Gamma");

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

  it("emits immutable updates on param edit and ignores undefined", async () => {
    const original: PriorSpec = {
      family: "Normal",
      params: { loc: 0, scale: 1 },
    };
    const wrapper = mount(PriorInput, { props: { modelValue: original } });
    const inputs = wrapper.findAllComponents(NumberInput);

    inputs[0].vm.$emit("update:modelValue", undefined);
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();

    inputs[1].vm.$emit("update:modelValue", 2.5);
    await wrapper.vm.$nextTick();
    expect(lastEmitted(wrapper)).toEqual({
      family: "Normal",
      params: { loc: 0, scale: 2.5 },
    });
    expect(original.params.scale).toBe(1);
  });

  it("disambiguates parameterizations, configures integer/decimals, and toggles preview", async () => {
    const distributions = [
      { family: "Exponential", params: [{ name: "rate", default: 1, min: 0 }] },
      {
        family: "Exponential",
        params: [{ name: "scale", default: 1, min: 0 }],
      },
    ];
    const multi = mount(PriorInput, {
      props: {
        distributions,
        families: ["Exponential"],
        modelValue: { family: "Exponential", params: { scale: 2 } },
      },
    });
    const select = multi.findComponent(SelectBox);
    expect(select.props("modelValue")).toBe("Exponential (scale)");
    select.vm.$emit("update:modelValue", "Exponential (rate)");
    await multi.vm.$nextTick();
    expect(lastEmitted(multi)).toEqual({
      family: "Exponential",
      params: { rate: 1 },
    });

    const binomial = mount(PriorInput, {
      props: {
        distributions: [
          {
            family: "Binomial",
            params: [
              { name: "n", default: 10, min: 0, integer: true },
              { name: "p", default: 0.5, min: 0, max: 1 },
            ],
          },
        ],
        modelValue: { family: "Binomial", params: { n: 10, p: 0.1234 } },
      },
    });
    const [countInput, probInput] = binomial.findAllComponents(NumberInput);
    expect(countInput.props("numberType")).toBe("integer");
    expect(probInput.props("decimals")).toBe(4);

    const preview = mount(PriorInput, {
      props: { modelValue: normal, preview: true },
    });
    await import("./PriorPreview.vue");
    await flushPromises();
    expect(preview.find("svg.prior-preview").exists()).toBe(true);
    await preview.setProps({
      modelValue: { family: "Normal", params: { loc: 0, scale: 0 } },
    });
    expect(preview.find("svg.prior-preview").exists()).toBe(false);
  });
});

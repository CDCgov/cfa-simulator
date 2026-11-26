import { describe, expect, it } from "vitest";
import {
  NUMPYRO_DISTRIBUTIONS,
  defaultPrior,
  descriptorFor,
  descriptorLabel,
  priorLabel,
} from "./distributions";

describe("distributions", () => {
  it("formats priorLabel cleanly and satisfies preset invariants", () => {
    expect(
      priorLabel({ family: "Exponential", params: { rate: 0.1 + 0.2 } }),
    ).toBe("Exponential(rate = 0.3)");
    expect(priorLabel({ family: "Flat", params: {} })).toBe("Flat()");

    const normal = NUMPYRO_DISTRIBUTIONS[0];
    expect(defaultPrior(normal).params).not.toBe(defaultPrior(normal).params);

    const names = NUMPYRO_DISTRIBUTIONS.map((item) => item.family);
    expect(new Set(names).size).toBe(names.length);
    for (const descriptor of NUMPYRO_DISTRIBUTIONS) {
      for (const param of descriptor.params) {
        if (/scale|rate|concentration|df/.test(param.name)) {
          expect(param.min, `${descriptor.family}.${param.name}`).toBe(0);
        }
      }
    }
  });

  it("matches the closest parameterization in descriptorFor and disambiguates labels", () => {
    const byRate = {
      family: "Exponential",
      params: [{ name: "rate", default: 1 }],
    };
    const byScale = {
      family: "Exponential",
      params: [{ name: "scale", default: 1 }],
    };
    expect(
      descriptorFor([byRate, byScale], {
        family: "Exponential",
        params: { scale: 2 },
      }),
    ).toBe(byScale);
    expect(
      descriptorFor([byRate, byScale], { family: "Exponential", params: {} }),
    ).toBe(byRate);
    expect(descriptorFor(NUMPYRO_DISTRIBUTIONS, undefined)).toBeUndefined();

    const two = {
      family: "F",
      params: [
        { name: "a", default: 0 },
        { name: "b", default: 0 },
      ],
    };
    const one = { family: "F", params: [{ name: "a", default: 0 }] };
    expect(descriptorFor([two, one], { family: "F", params: { a: 1 } })).toBe(
      one,
    );

    const list = [
      byRate,
      byScale,
      { family: "Normal", params: [{ name: "loc", default: 0 }] },
    ];
    expect(list.map((item) => descriptorLabel(item, list))).toEqual([
      "Exponential (rate)",
      "Exponential (scale)",
      "Normal",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  NUMPYRO_DISTRIBUTIONS,
  defaultPrior,
  descriptorFor,
  descriptorLabel,
  priorLabel,
} from "./distributions";
import type { DistributionDescriptor } from "./distributions";

// A family offered two ways, as a Rust model with `rate` xor `scale` needs.
const byRate: DistributionDescriptor = {
  family: "Exponential",
  label: "Exponential (rate)",
  params: [{ name: "rate", default: 1, min: 0 }],
};
const byScale: DistributionDescriptor = {
  family: "Exponential",
  label: "Exponential (scale)",
  params: [{ name: "scale", default: 1, min: 0 }],
};

describe("priorLabel", () => {
  it("formats the family with its params in order", () => {
    expect(priorLabel({ family: "Normal", params: { loc: 0, scale: 1 } })).toBe(
      "Normal(loc = 0, scale = 1)",
    );
  });

  it("hides float artifacts", () => {
    expect(
      priorLabel({ family: "Exponential", params: { rate: 0.1 + 0.2 } }),
    ).toBe("Exponential(rate = 0.3)");
  });

  it("handles a family with no params", () => {
    expect(priorLabel({ family: "Flat", params: {} })).toBe("Flat()");
  });
});

describe("defaultPrior", () => {
  it("fills every param with its default", () => {
    const gamma = NUMPYRO_DISTRIBUTIONS.find((d) => d.family === "Gamma")!;
    expect(defaultPrior(gamma)).toEqual({
      family: "Gamma",
      params: { concentration: 2, rate: 1 },
    });
  });

  it("returns a fresh object each call", () => {
    const normal = NUMPYRO_DISTRIBUTIONS[0];
    const a = defaultPrior(normal);
    const b = defaultPrior(normal);
    expect(a).not.toBe(b);
    expect(a.params).not.toBe(b.params);
  });
});

describe("NUMPYRO_DISTRIBUTIONS", () => {
  it("gives every strictly positive param an inclusive min of 0", () => {
    for (const d of NUMPYRO_DISTRIBUTIONS) {
      for (const p of d.params) {
        if (/scale|rate|concentration|df/.test(p.name)) {
          expect(p.min, `${d.family}.${p.name}`).toBe(0);
        }
      }
    }
  });

  it("has unique family names", () => {
    const names = NUMPYRO_DISTRIBUTIONS.map((d) => d.family);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("descriptorFor", () => {
  it("picks the parameterization whose names match the value", () => {
    const all = [byRate, byScale];
    expect(
      descriptorFor(all, { family: "Exponential", params: { scale: 2 } }),
    ).toBe(byScale);
    expect(
      descriptorFor(all, { family: "Exponential", params: { rate: 2 } }),
    ).toBe(byRate);
  });

  it("falls back to the first of the family when nothing matches", () => {
    expect(
      descriptorFor([byRate, byScale], { family: "Exponential", params: {} }),
    ).toBe(byRate);
    expect(
      descriptorFor(NUMPYRO_DISTRIBUTIONS, { family: "Nope", params: {} }),
    ).toBeUndefined();
    expect(descriptorFor(NUMPYRO_DISTRIBUTIONS, undefined)).toBeUndefined();
  });

  it("prefers the closest match over a superset", () => {
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
    expect(
      descriptorFor([one, two], { family: "F", params: { a: 1, b: 2 } }),
    ).toBe(two);
  });
});

describe("descriptorLabel", () => {
  it("is the family alone unless the family is offered more than once", () => {
    const unlabeled = [
      { family: "Exponential", params: [{ name: "rate", default: 1 }] },
      { family: "Exponential", params: [{ name: "scale", default: 1 }] },
      {
        family: "Normal",
        params: [
          { name: "loc", default: 0 },
          { name: "scale", default: 1 },
        ],
      },
    ];
    expect(unlabeled.map((d) => descriptorLabel(d, unlabeled))).toEqual([
      "Exponential (rate)",
      "Exponential (scale)",
      "Normal",
    ]);
    expect(descriptorLabel(byScale, [byRate, byScale])).toBe(
      "Exponential (scale)",
    );
  });
});

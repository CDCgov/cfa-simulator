/**
 * A prior as consumed by `cfasim_model.numpyro.to_distribution`: `family` is
 * a numpyro distribution class name and `params` its constructor kwargs.
 */
export interface PriorSpec {
  family: string;
  params: Record<string, number>;
}

export interface DistributionParam {
  /** numpyro keyword name, e.g. `loc`, `scale`, `concentration`. */
  name: string;
  /** Visible label; defaults to `name`. */
  label?: string;
  default: number;
  /** Inclusive bound passed to the NumberInput. */
  min?: number;
  max?: number;
  step?: number;
  /** Whole numbers only (a count or an index): integer field, step 1. */
  integer?: boolean;
}

/**
 * One way to parameterize a family. Several descriptors may share a `family`
 * to offer alternative parameterizations (an Exponential by `rate` or by
 * `scale`); they are told apart by label, see `descriptorLabel`.
 */
export interface DistributionDescriptor {
  /** numpyro class name, e.g. `Normal`. */
  family: string;
  /**
   * Visible label and dropdown value. Defaults to `family`, with the parameter
   * names appended when the family appears more than once in the list.
   */
  label?: string;
  params: DistributionParam[];
}

/** `"Exponential"`, or `"Exponential (scale)"` when the family is offered in several parameterizations. */
export function descriptorLabel(
  d: DistributionDescriptor,
  distributions: DistributionDescriptor[],
): string {
  if (d.label) return d.label;
  const shared = distributions.filter((o) => o.family === d.family).length > 1;
  if (!shared) return d.family;
  return `${d.family} (${d.params.map((p) => p.name).join(", ")})`;
}

/**
 * The descriptor that `spec` was built from: the one of its family whose
 * parameter names best match the spec's, so a loaded value shows the fields
 * it actually has when a family is offered in several parameterizations.
 */
export function descriptorFor(
  distributions: DistributionDescriptor[],
  spec: PriorSpec | undefined,
): DistributionDescriptor | undefined {
  if (!spec) return undefined;
  const keys = Object.keys(spec.params);
  let best: DistributionDescriptor | undefined;
  let bestScore = -Infinity;
  for (const d of distributions) {
    if (d.family !== spec.family) continue;
    const names = d.params.map((p) => p.name);
    const shared = names.filter((n) => keys.includes(n)).length;
    // Shared names count for, unmatched names on either side against.
    const score = shared * 2 - names.length - keys.length;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

const STEP = 0.1;
const real = (name: string, def: number): DistributionParam => ({
  name,
  default: def,
  step: STEP,
});
const positive = (name: string, def: number): DistributionParam => ({
  name,
  default: def,
  min: 0,
  step: STEP,
});

export const NUMPYRO_DISTRIBUTIONS: DistributionDescriptor[] = [
  {
    family: "Normal",
    params: [real("loc", 0), positive("scale", 1)],
  },
  {
    family: "LogNormal",
    params: [real("loc", 0), positive("scale", 1)],
  },
  {
    family: "HalfNormal",
    params: [positive("scale", 1)],
  },
  {
    family: "Uniform",
    params: [real("low", 0), real("high", 1)],
  },
  {
    family: "Gamma",
    params: [positive("concentration", 2), positive("rate", 1)],
  },
  {
    family: "Beta",
    params: [positive("concentration1", 2), positive("concentration0", 2)],
  },
  {
    family: "Exponential",
    params: [positive("rate", 1)],
  },
  {
    family: "TruncatedNormal",
    params: [
      real("loc", 0),
      positive("scale", 1),
      real("low", -2),
      real("high", 2),
    ],
  },
  {
    family: "Cauchy",
    params: [real("loc", 0), positive("scale", 1)],
  },
  {
    family: "HalfCauchy",
    params: [positive("scale", 1)],
  },
  {
    family: "StudentT",
    params: [positive("df", 3), real("loc", 0), positive("scale", 1)],
  },
  {
    family: "InverseGamma",
    params: [positive("concentration", 3), positive("rate", 1)],
  },
];

export function defaultPrior(d: DistributionDescriptor): PriorSpec {
  const params: Record<string, number> = {};
  for (const p of d.params) params[p.name] = p.default;
  return { family: d.family, params };
}

function formatValue(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  // Hide float artifacts such as 0.30000000000000004.
  return String(parseFloat(v.toPrecision(12)));
}

/** `"Normal(loc = 0, scale = 1)"`. */
export function priorLabel(spec: PriorSpec): string {
  const args = Object.entries(spec.params)
    .map(([k, v]) => `${k} = ${formatValue(v)}`)
    .join(", ");
  return `${spec.family}(${args})`;
}

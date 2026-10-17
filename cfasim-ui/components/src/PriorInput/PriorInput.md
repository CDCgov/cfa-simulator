---
keywords:
  [
    prior,
    distribution,
    bayesian,
    numpyro,
    pyrenew,
    normal,
    lognormal,
    gamma,
    beta,
    uniform,
    half-normal,
    rust,
    parameterization,
  ]
---

# PriorInput

A field for choosing a prior distribution: a family dropdown plus one number
input per parameter of the chosen family. The model is a `PriorSpec` whose
`family` and `params` use numpyro's class and keyword names, so it can be
handed straight to a Python model.

Switching family keeps any same-named parameters (`loc`, `scale`, …) and fills
the rest from the family's defaults.

## Examples

<script setup>
import { ref } from 'vue'
const prior = ref({ family: "Normal", params: { loc: 0, scale: 1 } })
const subset = ref({ family: "LogNormal", params: { loc: 0, scale: 0.5 } })
const previewed = ref({ family: "Gamma", params: { concentration: 2, rate: 1 } })
const custom = ref()
const tagged = ref({ family: "Exponential", params: { scale: 2 } })
const taggedDistributions = [
  {
    family: "Exponential",
    params: [{ name: "rate", default: 1, min: 0, step: 0.1 }],
  },
  {
    family: "Exponential",
    params: [{ name: "scale", default: 1, min: 0, step: 0.1 }],
  },
  {
    family: "DiscreteUniform",
    params: [
      { name: "low", default: 1, integer: true },
      { name: "high", default: 6, integer: true },
    ],
  },
  {
    family: "Binomial",
    params: [
      { name: "n", default: 10, min: 0, integer: true },
      { name: "p", default: 0.5, min: 0, max: 1, step: 0.05 },
    ],
  },
]
const toTagged = (spec) => ({ type: spec.family, ...spec.params })
const customDistributions = [
  {
    family: "LogNormal",
    label: "LogNormal (R0)",
    params: [
      { name: "loc", default: 0.3, step: 0.05 },
      { name: "scale", default: 0.2, min: 0, step: 0.05 },
    ],
  },
  {
    family: "Gamma",
    label: "Gamma (generation interval)",
    params: [
      { name: "concentration", label: "shape", default: 4, min: 0, step: 0.5 },
      { name: "rate", default: 1, min: 0, step: 0.1 },
    ],
  },
]
</script>

<ComponentDemo>
  <div style="width: 320px">
    <PriorInput v-model="prior" label="R0 prior" />
    <pre class="prior-output">{{ JSON.stringify(prior, null, 1) }}</pre>
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const prior = ref({ family: "Normal", params: { loc: 0, scale: 1 } });
</script>

<PriorInput v-model="prior" label="R0 prior" />
<pre>{{ JSON.stringify(prior, null, 1) }}</pre>
```

  </template>
</ComponentDemo>

### Subset of families

Pass `families` to offer only some of the built-in distributions, in the order
given. When mounted without a model, the first allowed family becomes the
default.

<ComponentDemo>
  <div style="width: 320px">
    <PriorInput
      v-model="subset"
      label="Scale prior"
      :families="['Normal', 'LogNormal', 'HalfNormal']"
    />
  </div>

<template #code>

```vue
<PriorInput
  v-model="subset"
  label="Scale prior"
  :families="['Normal', 'LogNormal', 'HalfNormal']"
/>
```

  </template>
</ComponentDemo>

### Preview and summary

`preview` draws a small density sparkline of the current prior and `summary`
prints it as text, e.g. `Gamma(concentration = 2, rate = 1)`. The sparkline
disappears when the parameters do not give a finite density (a zero scale,
for instance).

<ComponentDemo>
  <div style="width: 320px">
    <PriorInput v-model="previewed" label="Infectious period" preview summary />
  </div>

<template #code>

```vue
<PriorInput v-model="previewed" label="Infectious period" preview summary />
```

  </template>
</ComponentDemo>

### Custom distributions

Pass your own `distributions` array to change labels, defaults, steps, or
bounds, or to add a family that is not in the preset. The `family` and every
`name` are whatever your model's library expects (numpyro's class and keyword
names for the preset); `label` is only what people see.

<ComponentDemo>
  <div style="width: 320px">
    <PriorInput
      v-model="custom"
      label="Model prior"
      :distributions="customDistributions"
      preview
      summary
    />
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const custom = ref();
const customDistributions = [
  {
    family: "LogNormal",
    label: "LogNormal (R0)",
    params: [
      { name: "loc", default: 0.3, step: 0.05 },
      { name: "scale", default: 0.2, min: 0, step: 0.05 },
    ],
  },
  {
    family: "Gamma",
    label: "Gamma (generation interval)",
    params: [
      { name: "concentration", label: "shape", default: 4, min: 0, step: 0.5 },
      { name: "rate", default: 1, min: 0, step: 0.1 },
    ],
  },
];
</script>

<PriorInput
  v-model="custom"
  label="Model prior"
  :distributions="customDistributions"
  preview
  summary
/>
```

  </template>
</ComponentDemo>

### Other libraries, parameterizations, and integers

The same descriptors fit a model written against another library, such as a
Rust one whose distributions take different names. Two descriptors may share a
`family` to offer alternative parameterizations: the dropdown then appends the
parameter names ("Exponential (rate)", "Exponential (scale)") unless you give
a `label`. A loaded value shows the parameterization whose names it carries
(`descriptorFor` does that lookup). A parameter with
`integer: true` is a whole-number field. Libraries that want a flat tagged
object instead of `{ family, params }` are one spread away.

<ComponentDemo>
  <div style="width: 320px">
    <PriorInput
      v-model="tagged"
      label="Rust prior"
      :distributions="taggedDistributions"
      summary
    />
    <pre class="prior-output">{{ JSON.stringify(toTagged(tagged)) }}</pre>
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const tagged = ref({ family: "Exponential", params: { scale: 2 } });
const taggedDistributions = [
  {
    family: "Exponential",
    params: [{ name: "rate", default: 1, min: 0, step: 0.1 }],
  },
  {
    family: "Exponential",
    params: [{ name: "scale", default: 1, min: 0, step: 0.1 }],
  },
  {
    family: "DiscreteUniform",
    params: [
      { name: "low", default: 1, integer: true },
      { name: "high", default: 6, integer: true },
    ],
  },
  {
    family: "Binomial",
    params: [
      { name: "n", default: 10, min: 0, integer: true },
      { name: "p", default: 0.5, min: 0, max: 1, step: 0.05 },
    ],
  },
];
// {"type":"Exponential","scale":2}, the shape a serde-tagged enum reads.
const toTagged = (spec) => ({ type: spec.family, ...spec.params });
</script>

<PriorInput
  v-model="tagged"
  label="Rust prior"
  :distributions="taggedDistributions"
  summary
/>
```

  </template>
</ComponentDemo>

The `preview` sparkline knows the numpyro families' densities only; it stays
blank for other families. Vector-valued parameters (a Dirichlet's `alpha`) are
not supported yet.

## Python counterpart

`cfasim_model.numpyro.to_distribution(spec)` builds
`getattr(numpyro.distributions, spec["family"])(**spec["params"])`, so `family`
must be a numpyro class name and each param name one of its constructor
keywords; `label` is the only free text. Strictly positive parameters have
`min: 0` in the preset, which the number input treats as inclusive: a value of
exactly `0` passes here but numpyro rejects it, and the `preview` sparkline goes
blank as a hint.

## Accessibility

- The field is a `role="group"` named by `label` (or `aria-label`); inside it,
  the family [SelectBox](./select-box) has a visually hidden "Family" label and
  every parameter [NumberInput](./number-input) a visible one.
- The preview is an `<svg role="img">` labelled with the `summary` text.

<!--@include: ./_api/prior-input.md-->

### PriorSpec

```ts
interface PriorSpec {
  /** numpyro distribution class name, e.g. "Normal". */
  family: string;
  /** Constructor kwargs for that class. */
  params: Record<string, number>;
}
```

### DistributionDescriptor

One way to parameterize a family. Several descriptors may share a `family`.

```ts
interface DistributionDescriptor {
  /** numpyro class name. */
  family: string;
  /**
   * Visible label and dropdown value. Defaults to `family`, with the parameter
   * names appended when the family appears more than once.
   */
  label?: string;
  params: DistributionParam[];
}
```

### DistributionParam

```ts
interface DistributionParam {
  /** numpyro keyword name. */
  name: string;
  /** Visible label; defaults to `name`. */
  label?: string;
  default: number;
  /** Inclusive bounds passed to the NumberInput. */
  min?: number;
  max?: number;
  step?: number;
  /** Whole numbers only: integer field, step 1 unless given. */
  integer?: boolean;
}
```

### descriptorFor

```ts
function descriptorFor(
  distributions: DistributionDescriptor[],
  spec: PriorSpec | undefined,
): DistributionDescriptor | undefined;
```

The descriptor of `spec.family` whose parameter names best match
`spec.params`, or the family's first one.

### NUMPYRO_DISTRIBUTIONS

The default `distributions`. Every parameter uses `step: 0.1`; parameters
marked `> 0` have `min: 0`.

| Family            | Parameters (default)                                   |
| ----------------- | ------------------------------------------------------ |
| `Normal`          | `loc` (0), `scale` (1) `> 0`                           |
| `LogNormal`       | `loc` (0), `scale` (1) `> 0`                           |
| `HalfNormal`      | `scale` (1) `> 0`                                      |
| `Uniform`         | `low` (0), `high` (1)                                  |
| `Gamma`           | `concentration` (2) `> 0`, `rate` (1) `> 0`            |
| `Beta`            | `concentration1` (2) `> 0`, `concentration0` (2) `> 0` |
| `Exponential`     | `rate` (1) `> 0`                                       |
| `TruncatedNormal` | `loc` (0), `scale` (1) `> 0`, `low` (-2), `high` (2)   |
| `Cauchy`          | `loc` (0), `scale` (1) `> 0`                           |
| `HalfCauchy`      | `scale` (1) `> 0`                                      |
| `StudentT`        | `df` (3) `> 0`, `loc` (0), `scale` (1) `> 0`           |
| `InverseGamma`    | `concentration` (3) `> 0`, `rate` (1) `> 0`            |

### priorLabel

```ts
function priorLabel(spec: PriorSpec): string;
// priorLabel({ family: "Normal", params: { loc: 0, scale: 1 } })
// => "Normal(loc = 0, scale = 1)"
```

<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import FieldLabel from "../_internal/FieldLabel.vue";
import { useField, type FieldProps } from "../_internal/field";
import NumberInput from "../NumberInput/NumberInput.vue";
import SelectBox from "../SelectBox/SelectBox.vue";
import {
  NUMPYRO_DISTRIBUTIONS,
  defaultPrior,
  descriptorFor,
  descriptorLabel,
  priorLabel,
  type DistributionDescriptor,
  type PriorSpec,
} from "./distributions";

const model = defineModel<PriorSpec>();

// The density math only loads when a preview is shown.
const PriorPreview = defineAsyncComponent(() => import("./PriorPreview.vue"));

interface Props extends FieldProps {
  /** Distribution descriptors to offer. Defaults to the numpyro preset. */
  distributions?: DistributionDescriptor[];
  /** Restrict the family dropdown to these families, in this order. */
  families?: string[];
  /** Draw a density sparkline of the current prior. */
  preview?: boolean;
  /** Show the prior as text, e.g. "Normal(loc = 0, scale = 1)". */
  summary?: boolean;
  /**
   * `"stacked"` (default) puts the family dropdown above the parameter
   * fields. `"compact"` lays the dropdown and the parameter fields out in
   * one row of equal-width columns under the field's label, each parameter
   * named by description text beneath its field, and keeps the preview and
   * summary below. Past three parameters the dropdown takes its own row and
   * the parameters share the next one.
   */
  layout?: "stacked" | "compact";
}

const props = withDefaults(defineProps<Props>(), {
  distributions: () => NUMPYRO_DISTRIBUTIONS,
  layout: "stacked",
});

const { labelId, ariaProps } = useField(props);

const available = computed<DistributionDescriptor[]>(() => {
  const all = props.distributions;
  if (!props.families) return all;
  // Every parameterization of a listed family, in the listed order.
  return props.families.flatMap((f) => all.filter((d) => d.family === f));
});

const keyOf = (d: DistributionDescriptor) =>
  descriptorLabel(d, props.distributions);

const options = computed(() =>
  available.value.map((d) => {
    const key = keyOf(d);
    return { value: key, label: key };
  }),
);

// Looked up across every descriptor so a model whose family was filtered out
// by `families` still shows its parameters.
const current = computed(() => descriptorFor(props.distributions, model.value));

// Grid columns: one per parameter, plus one for the family when the compact
// layout keeps it on the same row (up to three parameters).
const MAX_ROW_PARAMS = 3;
const paramCount = computed(() => current.value?.params.length ?? 0);
const splitRows = computed(() => paramCount.value > MAX_ROW_PARAMS);
const columns = computed(() =>
  props.layout === "compact" && !splitRows.value
    ? paramCount.value + 1
    : paramCount.value,
);

if (model.value === undefined && available.value.length > 0) {
  model.value = defaultPrior(available.value[0]);
}

function setFamily(key: string | undefined) {
  if (!key) return;
  const descriptor = props.distributions.find((d) => keyOf(d) === key);
  if (!descriptor) return;
  const previous = model.value?.params ?? {};
  const params: Record<string, number> = {};
  for (const p of descriptor.params) {
    params[p.name] = previous[p.name] ?? p.default;
  }
  model.value = { family: descriptor.family, params };
}

// NumberInput infers its display precision from `step`, which would show a
// prior of 0.143 as "0.1". Show at least two decimals and every decimal the
// current value has, so loaded values survive a round trip through the field.
function decimalsFor(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 2;
  const text = parseFloat(Math.abs(value).toPrecision(12)).toString();
  const dot = text.indexOf(".");
  const decimals = dot === -1 ? 0 : text.length - dot - 1;
  return Math.min(6, Math.max(2, decimals));
}

function setParam(name: string, value: number | undefined) {
  if (value === undefined || !model.value) return;
  model.value = {
    ...model.value,
    params: { ...model.value.params, [name]: value },
  };
}
</script>

<template>
  <div class="prior-input" :data-layout="layout">
    <FieldLabel
      class="prior-label"
      :label="label"
      :label-id="labelId"
      :hide-label="hideLabel"
      :hint="hint"
    />
    <div
      role="group"
      class="prior-group"
      :class="{ 'prior-group-split': splitRows }"
      :style="{ '--prior-columns': columns }"
      v-bind="ariaProps"
    >
      <SelectBox
        class="prior-family"
        :model-value="current ? keyOf(current) : model?.family"
        label="Family"
        hide-label
        :options="options"
        @update:model-value="setFamily"
      />
      <div v-if="current" class="prior-params">
        <NumberInput
          v-for="p in current.params"
          :key="`${current.family}:${p.name}`"
          :label="p.label ?? p.name"
          :model-value="model?.params[p.name]"
          :number-type="p.integer ? 'integer' : 'float'"
          :min="p.min"
          :max="p.max"
          :step="p.step ?? (p.integer ? 1 : undefined)"
          :decimals="p.integer ? 0 : decimalsFor(model?.params[p.name])"
          @update:model-value="setParam(p.name, $event)"
        />
      </div>
      <PriorPreview v-if="preview && model" :spec="model" />
      <span v-if="summary && model" class="prior-summary">
        {{ priorLabel(model) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.prior-input {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
}

.prior-label {
  display: flex;
  align-items: center;
  gap: 0.25em;
  font-size: var(--font-size-sm);
}

/* Anchors the Family select's visually-hidden label. */
.prior-group {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}

/* One equal column per parameter. */
.prior-params {
  display: grid;
  grid-template-columns: repeat(var(--prior-columns), minmax(0, 1fr));
  gap: 0.5em;
}

.prior-params > * {
  min-width: 0;
}

.prior-summary {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-family: var(--font-family-mono);
}

[data-layout="compact"] .prior-group {
  display: grid;
  grid-template-columns: repeat(var(--prior-columns), minmax(0, 1fr));
  align-items: start;
}

[data-layout="compact"] .prior-params {
  display: contents;
}

[data-layout="compact"] .prior-group-split .prior-family,
[data-layout="compact"] :deep(.prior-preview),
[data-layout="compact"] .prior-summary {
  grid-column: 1 / -1;
}

/* The trigger hugs its text by default; fill the column and clip instead. */
[data-layout="compact"] .prior-family :deep(.select-trigger) {
  width: 100%;
  min-width: 0;
}

[data-layout="compact"]
  .prior-family
  :deep(.select-trigger > span:first-child) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Parameter names read as description text tucked under their fields. */
[data-layout="compact"] .prior-params :deep(.cfasim-input-label-row) {
  order: 1;
  margin-top: -0.125em;
  font-size: var(--font-size-xs);
  line-height: 1.25;
  color: var(--color-text-secondary);
}
</style>

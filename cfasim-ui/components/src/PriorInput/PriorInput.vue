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
}

const props = withDefaults(defineProps<Props>(), {
  distributions: () => NUMPYRO_DISTRIBUTIONS,
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
  <div class="prior-input">
    <FieldLabel
      class="prior-label"
      :label="label"
      :label-id="labelId"
      :hide-label="hideLabel"
      :hint="hint"
    />
    <div role="group" class="prior-group" v-bind="ariaProps">
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

.prior-params {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
}

.prior-params > * {
  flex: 1 1 6em;
  min-width: 5em;
}

.prior-summary {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-family: var(--font-family-mono);
}
</style>

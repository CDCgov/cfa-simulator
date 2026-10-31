<script setup lang="ts">
import { computed, useSlots } from "vue";
import Icon from "../Icon/Icon.vue";
import type {
  ListDescriptionPosition,
  ListOption,
  ListSwatchPosition,
} from "../List/List.vue";
import "./option.css";

// One part of a List/Menu row: `main` is the start visual plus text,
// `end` the trailing description/swatch. Callers forward their own
// start/text/end slots only when the consumer gave them.
const props = defineProps<{
  part: "main" | "end";
  item: ListOption;
  index: number;
  swatchPosition: ListSwatchPosition;
  descriptionPosition: ListDescriptionPosition;
}>();

const slots = useSlots();

const hasEnd = computed(
  () =>
    !!slots.end ||
    (!!props.item.description && props.descriptionPosition === "end") ||
    (!!props.item.swatch && props.swatchPosition === "end"),
);
</script>

<template>
  <template v-if="part === 'main'">
    <slot name="start" :item="item" :index="index">
      <span
        v-if="item.swatch && swatchPosition === 'start'"
        class="OptionSwatch"
        :style="{ backgroundColor: item.swatch }"
        aria-hidden="true"
      />
      <Icon v-if="item.icon" class="OptionIcon" :icon="item.icon" size="sm" />
    </slot>
    <span class="OptionText">
      <slot name="text" :item="item" :index="index">
        <span class="OptionLabel">{{ item.label }}</span>
        <span
          v-if="item.description && descriptionPosition === 'below'"
          class="OptionDescription"
        >
          {{ item.description }}
        </span>
      </slot>
    </span>
  </template>
  <span v-else-if="hasEnd" class="OptionEnd">
    <slot name="end" :item="item" :index="index">
      <span
        v-if="item.description && descriptionPosition === 'end'"
        class="OptionDescription OptionDescriptionEnd"
      >
        {{ item.description }}
      </span>
      <span
        v-if="item.swatch && swatchPosition === 'end'"
        class="OptionSwatchEnd"
        aria-hidden="true"
      >
        <span class="OptionSwatch" :style="{ backgroundColor: item.swatch }" />
      </span>
    </slot>
  </span>
</template>

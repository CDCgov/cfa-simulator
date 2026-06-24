<script setup lang="ts">
withDefaults(
  defineProps<{
    ariaLabel?: string;
    orientation?: "horizontal" | "vertical";
  }>(),
  { orientation: "horizontal" },
);
</script>

<template>
  <div
    class="button-group"
    role="group"
    :data-orientation="orientation"
    :aria-label="ariaLabel"
  >
    <slot />
  </div>
</template>

<style scoped>
.button-group {
  display: inline-flex;
}

.button-group[data-orientation="vertical"] {
  flex-direction: column;
}

/* Children butt directly against each other; only the outer corners stay
 * rounded and all children stretch to a common size. */
.button-group :deep(> *) {
  border-radius: 0;
  align-self: stretch;
}

/* Pull each child onto its neighbour so a pair of adjacent borders collapses
 * into a single shared 1px divider (instead of two borders + a gap). */
.button-group[data-orientation="horizontal"] :deep(> *:not(:first-child)) {
  margin-left: -1px;
}

.button-group[data-orientation="vertical"] :deep(> *:not(:first-child)) {
  margin-top: -1px;
}

/* Lift the active child so its full border / focus ring shows above the
 * overlapping neighbour. */
.button-group :deep(> *:hover),
.button-group :deep(> *:focus-visible),
.button-group :deep(> *:focus) {
  position: relative;
  z-index: 1;
}

/* Bordered buttons share their border as the divider. The solid `Button`
 * variant has no border, so give adjacent solid buttons a divider of their
 * own (a contrast-derived hairline that reads on the button colour). */
.button-group[data-orientation="horizontal"]
  :deep(.button[data-variant="primary"] + .button[data-variant="primary"]) {
  border-left: 1px solid
    color-mix(in srgb, var(--color-text-on-primary) 35%, transparent);
}

.button-group[data-orientation="vertical"]
  :deep(.button[data-variant="primary"] + .button[data-variant="primary"]) {
  border-top: 1px solid
    color-mix(in srgb, var(--color-text-on-primary) 35%, transparent);
}

.button-group[data-orientation="horizontal"] :deep(> *:first-child) {
  border-top-left-radius: 0.375em;
  border-bottom-left-radius: 0.375em;
}

.button-group[data-orientation="horizontal"] :deep(> *:last-child) {
  border-top-right-radius: 0.375em;
  border-bottom-right-radius: 0.375em;
}

.button-group[data-orientation="vertical"] :deep(> *:first-child) {
  border-top-left-radius: 0.375em;
  border-top-right-radius: 0.375em;
}

.button-group[data-orientation="vertical"] :deep(> *:last-child) {
  border-bottom-left-radius: 0.375em;
  border-bottom-right-radius: 0.375em;
}
</style>

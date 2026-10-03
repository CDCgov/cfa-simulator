import { computed, ref } from "vue";

export interface LegendToggleOptions {
  /** Controlled list of hidden legend labels; undefined = uncontrolled. */
  hidden: () => readonly string[] | undefined;
  onUpdate: (hidden: string[]) => void;
}

/**
 * Show/hide state for legend-toggled marks, keyed by legend label so
 * marks sharing a label toggle together. Works controlled (the `hidden`
 * getter returns an array) or uncontrolled (local state).
 */
export function useLegendToggle(opts: LegendToggleOptions) {
  const local = ref<string[]>([]);
  const hiddenLabels = computed(() => opts.hidden() ?? local.value);
  const hiddenSet = computed(() => new Set(hiddenLabels.value));

  function isHidden(label: string | undefined): boolean {
    return label != null && hiddenSet.value.has(label);
  }

  function toggle(label: string) {
    const next = isHidden(label)
      ? hiddenLabels.value.filter((l) => l !== label)
      : [...hiddenLabels.value, label];
    local.value = next;
    opts.onUpdate(next);
  }

  return { isHidden, toggle };
}

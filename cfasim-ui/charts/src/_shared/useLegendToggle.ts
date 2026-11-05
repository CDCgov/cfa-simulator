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

  function update(next: string[]) {
    local.value = next;
    opts.onUpdate(next);
  }

  function toggle(label: string) {
    update(
      isHidden(label)
        ? hiddenLabels.value.filter((l) => l !== label)
        : [...hiddenLabels.value, label],
    );
  }

  /**
   * Show only `label` out of `labels`, or everything again when it is
   * already the only one showing.
   */
  function isolate(label: string, labels: readonly string[]) {
    const others = labels.filter((l) => l !== label);
    const alone = !isHidden(label) && others.every(isHidden);
    update(alone ? [] : others);
  }

  return { isHidden, toggle, isolate };
}

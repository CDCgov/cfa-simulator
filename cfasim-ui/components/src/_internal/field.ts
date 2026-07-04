import { computed } from "vue";
import { useId } from "reka-ui";

/** Props shared by every labeled form field. */
export interface FieldProps {
  label?: string;
  /** Visually hide the label while keeping it for assistive tech. */
  hideLabel?: boolean;
  /** Accessible name used when no visible `label` is provided. */
  ariaLabel?: string;
  hint?: string;
}

/**
 * Generated field/label ids plus the aria attributes that point a control
 * at its label: `aria-labelledby` when a visible `label` exists, else
 * `aria-label`. Spread onto the control with `v-bind="ariaProps.value"`.
 */
export function useField(props: FieldProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const ariaProps = computed(() => ({
    "aria-labelledby": props.label ? labelId : undefined,
    "aria-label": !props.label ? props.ariaLabel : undefined,
  }));
  return { id, labelId, ariaProps };
}

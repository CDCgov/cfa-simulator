/**
 * Default categorical series colors, from the theme with fallbacks. Each
 * entry must stay distinct under the theme: `--color-accent` is an alias of
 * `--color-primary`, and `--color-warning` is already a yellow, so the
 * second color is a plain orange.
 */
export const CATEGORICAL_COLORS = [
  "var(--color-primary, #3b82f6)",
  "#f97316",
  "var(--color-success, #10b981)",
  "var(--color-danger, #ef4444)",
  "var(--color-info, #6366f1)",
  "var(--color-warning, #d97706)",
];

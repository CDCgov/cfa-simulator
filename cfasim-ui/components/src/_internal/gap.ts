export type GapToken = "none" | "small" | "medium" | "large";

const GAP_TOKENS: Record<GapToken, string> = {
  none: "0",
  small: "var(--space-2)",
  medium: "var(--space-4)",
  large: "var(--space-6)",
};

export function resolveGap(
  gap: GapToken | string | undefined,
  fallback: GapToken = "medium",
): string {
  if (gap == null) return GAP_TOKENS[fallback];
  if (gap in GAP_TOKENS) return GAP_TOKENS[gap as GapToken];
  return gap;
}

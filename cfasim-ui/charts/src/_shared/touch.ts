/**
 * Whether the current device has a touch screen. A function (not a
 * module-level constant) so unit tests can mock it per-case and so SSR
 * evaluation is deferred until an event actually needs the answer.
 */
export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && "ontouchstart" in window;
}

/**
 * Convert a worker `ErrorEvent` into a human-readable message. Cross-origin
 * worker failures sanitize the event so every field is null/empty (e.g. the
 * worker's module — or a dynamic CDN import inside it — fails to evaluate);
 * fall back to a hint about likely causes rather than an empty string.
 */
export function describeWorkerError(e: ErrorEvent): string {
  const msg = e.message || e.error?.message || "";
  if (msg) {
    if (e.filename) return `${msg} (${e.filename}:${e.lineno})`;
    return msg;
  }
  return "Worker failed to load (no error details available — most often a cross-origin script load failure or a syntax error in the worker module)";
}

export const MESSAGEERROR_TEXT =
  "Worker received a message it could not deserialize (messageerror)";

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

/**
 * Message for a call that died in a WebAssembly trap. `panic` is the text
 * recorded by `cfasim-model`'s panic hook (`panicked at <file>:<line>:<col>:
 * <message>`) when the model panicked. `canRecord` says the module exports
 * that hook at all; when it does not, the model is built on a cfasim-model
 * too old to say. An `unreachable` trap with nothing recorded is an abort:
 * the allocator giving up, or a panic after the model replaced the hook.
 * Engines word the trap differently ("unreachable", "unreachable executed",
 * "Unreachable code should not be executed"), hence the loose match.
 */
export function describeWasmTrap(
  trapMessage: string,
  panic: string | undefined,
  canRecord: boolean,
): string {
  if (panic) return `Model ${panic}`;
  if (!/unreachable/i.test(trapMessage)) return `Model trapped: ${trapMessage}`;
  if (canRecord) {
    return "Model aborted without a recorded panic message: it ran out of memory, or it replaced the panic hook outside a start function";
  }
  return "Model panicked or aborted (unreachable); rebuild it against the current cfasim-model to see the panic message";
}

/**
 * Message for a trap while the module initialized. The panic hook is
 * installed after init, so a start-function panic has no recorded message.
 */
export function describeWasmInitTrap(trapMessage: string): string {
  if (/unreachable/i.test(trapMessage)) {
    return "Model panicked or aborted while initializing, before the panic hook could be installed";
  }
  return `Model trapped while initializing: ${trapMessage}`;
}

/**
 * Whether an error thrown by a wasm call left the instance unusable. A
 * `WebAssembly.RuntimeError` is any trap (a Rust panic or abort ends in
 * `unreachable`). A stack overflow is not a trap but unwinds through the
 * wasm frames without running their epilogues, so the shadow stack pointer
 * is left wherever it was: V8 throws a `RangeError`, SpiderMonkey an
 * `InternalError`. A JS-side overflow in the worker would match too; the
 * worker has no recursion of its own, and the cost is one spare replacement.
 */
export function isWasmTrap(error: unknown): boolean {
  if (error instanceof WebAssembly.RuntimeError) return true;
  if (!(error instanceof Error)) return false;
  return (
    (error.name === "RangeError" || error.name === "InternalError") &&
    /call stack|too much recursion/i.test(error.message)
  );
}

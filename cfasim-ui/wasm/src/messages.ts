/** A call into a model: positional `args` or named `inputs`, never both. */
export interface WorkerMessage {
  id: number;
  model: string;
  fn: string;
  /** Positional arguments for a plain `#[wasm_bindgen]` function. */
  args?: string[];
  /**
   * Named inputs for a function exported with `cfasim_model::export!`. Only
   * the worker knows how a function was exported, so for a plain
   * `#[wasm_bindgen]` one it passes the values positionally instead.
   */
  inputs?: Record<string, unknown>;
}

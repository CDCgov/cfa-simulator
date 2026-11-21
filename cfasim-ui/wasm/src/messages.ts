export interface WorkerMessage {
  id: number;
  model: string;
  fn: string;
  /** Positional arguments, for functions exported with plain `#[wasm_bindgen]`. */
  args: string[];
  /**
   * Named inputs as a JSON object, for functions exported with
   * `cfasim_model::export!`. Sent together with the same values in `args`,
   * since only the worker knows which convention the function uses.
   */
  inputs?: string;
}

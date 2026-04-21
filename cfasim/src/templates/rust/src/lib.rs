use cfasim_model::{model_outputs, ModelOutput};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn double(n: i32) -> i32 {
    n * 2
}

// Pure helper so the numerical logic is testable natively.
// wasm-bindgen functions that return `JsValue` can't run under `cargo test`.
fn compute(steps: u32, rate: f64) -> (Vec<f64>, Vec<f64>) {
    let time: Vec<f64> = (0..steps).map(|i| i as f64).collect();
    let values: Vec<f64> = (0..steps).map(|i| rate * i as f64).collect();
    (time, values)
}

#[wasm_bindgen]
pub fn simulate(steps: u32, rate: f64) -> JsValue {
    let (time, values) = compute(steps, rate);

    let series = ModelOutput::new(steps as usize)
        .add_f64("time", time)
        .add_f64("values", values);

    model_outputs([("series", series)])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_double() {
        assert_eq!(double(3), 6);
        assert_eq!(double(0), 0);
        assert_eq!(double(-4), -8);
    }

    #[test]
    fn test_compute_shape() {
        let (time, values) = compute(5, 2.0);
        assert_eq!(time.len(), 5);
        assert_eq!(values.len(), 5);
    }

    #[test]
    fn test_compute_values() {
        let (time, values) = compute(4, 3.0);
        assert_eq!(time, vec![0.0, 1.0, 2.0, 3.0]);
        assert_eq!(values, vec![0.0, 3.0, 6.0, 9.0]);
    }
}

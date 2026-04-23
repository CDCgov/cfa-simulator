use cfasim_model::{model_outputs, ModelOutput};
use wasm_bindgen::prelude::*;

fn step(state: f64, rate: f64) -> f64 {
    state + rate
}

// Pure helper so the numerical logic is testable natively.
// wasm-bindgen functions that return `JsValue` can't run under `cargo test`.
fn compute(steps: u32, rate: f64) -> (Vec<f64>, Vec<f64>) {
    let n = steps as usize;
    let mut time = Vec::with_capacity(n);
    let mut values = Vec::with_capacity(n);
    let mut state = 0.0;
    for t in 0..steps {
        time.push(t as f64);
        values.push(state);
        state = step(state, rate);
    }
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
    fn test_step() {
        assert_eq!(step(0.0, 3.0), 3.0);
        assert_eq!(step(5.0, 2.5), 7.5);
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

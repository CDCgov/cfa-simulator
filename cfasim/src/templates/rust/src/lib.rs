use cfasim_model::{model_outputs, ModelOutput};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn double(n: i32) -> i32 {
    n * 2
}

#[wasm_bindgen]
pub fn simulate(steps: u32, rate: f64) -> JsValue {
    let time: Vec<f64> = (0..steps).map(|i| i as f64).collect();
    let values: Vec<f64> = (0..steps).map(|i| rate * i as f64).collect();

    let series = ModelOutput::new(steps as usize)
        .add_f64("time", time)
        .add_f64("values", values);

    model_outputs([("series", series)])
}

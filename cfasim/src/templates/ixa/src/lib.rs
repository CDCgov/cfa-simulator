//! WASM entry point. Wraps `model::run` so the frontend can call it as
//! `simulate(...)` and receive a `ModelOutput` it can plot directly.

mod model;
mod stats;

use cfasim_model::{model_outputs, ModelOutput};
use wasm_bindgen::prelude::*;

use crate::model::Parameters;

/// Runs `n_simulations` independent realizations (seeds `0..n_simulations`)
/// and returns one `time` column plus one `values_{i}` column per run, so
/// the frontend can spaghetti-plot them.
#[wasm_bindgen]
pub fn simulate(
    infection_rate: f64,
    population: u32,
    max_time: f64,
    n_simulations: u32,
) -> JsValue {
    let params = Parameters {
        infection_rate,
        population: population as usize,
        max_time,
    };

    let mut time: Vec<f64> = Vec::new();
    let mut trajectories: Vec<Vec<f64>> = Vec::with_capacity(n_simulations as usize);
    for i in 0..n_simulations {
        let (t, values) = model::run(params.clone(), i as u64);
        if i == 0 {
            time = t;
        }
        trajectories.push(values);
    }

    let mut series = ModelOutput::new(time.len()).add_f64("time", time);
    for (i, values) in trajectories.into_iter().enumerate() {
        series = series.add_f64(&format!("values_{i}"), values);
    }

    model_outputs([("series", series)])
}

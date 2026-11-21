//! WASM entry point. Wraps `model::run` so the frontend can call it as
//! `useOutputs("simulate", params)` and receive a `ModelOutput` it can plot
//! directly.

mod model;
mod stats;

use cfasim_model::{export, ModelOutput, Outputs};
use serde::Deserialize;

use crate::model::Parameters;

/// Inputs of `simulate`, matched by name to the params object in `App.vue`;
/// `serde(rename_all = "camelCase")` bridges the JS field names to the
/// snake_case Rust ones.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SimulateArgs {
    infectiousness: f64,
    infectious_period: f64,
    population: u32,
    initial_infections: u32,
    max_time: f64,
    n_simulations: u32,
}

/// Runs `n_simulations` independent realizations (seeds `0..n_simulations`)
/// and returns one `time` column plus one `values_{i}` column per run, so
/// the frontend can spaghetti-plot them. A missing or mistyped input reaches
/// the page as the `error` from `useOutputs`; a panic does too, with its file
/// and line. An `Err` returned here (such as an invalid parameter) is shown
/// the same way.
fn simulate(args: SimulateArgs) -> Result<Outputs, String> {
    let params = Parameters {
        population: args.population as usize,
        initial_infections: args.initial_infections as usize,
        infectiousness: args.infectiousness,
        infectious_period: args.infectious_period,
        max_time: args.max_time,
    };

    let mut time: Vec<f64> = Vec::new();
    let mut trajectories: Vec<Vec<f64>> = Vec::with_capacity(args.n_simulations as usize);
    for i in 0..args.n_simulations {
        let (t, values) = model::run(params.clone(), i as u64)?;
        if i == 0 {
            time = t;
        }
        trajectories.push(values);
    }

    let mut series = ModelOutput::new(time.len()).add_f64("time", time);
    for (i, values) in trajectories.into_iter().enumerate() {
        series = series.add_f64(&format!("values_{i}"), values);
    }

    Ok(Outputs::new().add("series", series))
}

// Makes `simulate` callable from the page. List every exported function
// here, e.g. `export!(simulate, summarize)`.
export!(simulate);

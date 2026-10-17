//! Tasks the interactive UI can start on the local cfasim server.
//!
//! `cfasim serve` builds this binary (`cargo build --release`) and keeps it
//! running as a worker; `pnpm dev` starts it for you. Each task gets a context
//! for progress, logging, and outputs, plus inputs deserialized from the page.

use cfasim_model::tasks::{Context, Result, Tasks};
use cfasim_model::{ModelOutput, Outputs};
use serde::{Deserialize, Serialize};

use {{ module_name }}::compute;

/// Inputs of `simulate`; the defaults describe the parameters to the page.
#[derive(Serialize, Deserialize)]
#[serde(default)]
struct SimulateInputs {
    steps: u32,
    rate: f64,
}

impl Default for SimulateInputs {
    fn default() -> Self {
        Self {
            steps: 10,
            rate: 2.5,
        }
    }
}

fn simulate(ctx: &mut Context, inputs: SimulateInputs) -> Result<Outputs> {
    ctx.progress(0.0, "simulating");
    let (time, values) = compute(inputs.steps, inputs.rate);
    ctx.progress(1.0, "done");
    let series = ModelOutput::new(time.len())
        .add_f64("time", time)
        .add_f64("values", values);
    Ok(Outputs::new().add("series", series))
}

fn main() {
    Tasks::new()
        .task("simulate", simulate)
        .doc("Run the model and return its series.")
        .serve();
}

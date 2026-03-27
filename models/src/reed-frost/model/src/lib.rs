use cfasim_model::{model_outputs, ModelOutput};
use wasm_bindgen::prelude::*;
mod model;

#[wasm_bindgen]
pub fn pmf(s_inf: usize, s: usize, i: usize, p: f64) -> f64 {
    model::pmf(s_inf, s, i, p)
}

/// Reed-Frost epidemic simulation.
/// Runs `n_trajectories` stochastic simulations and returns cumulative
/// infections over generations for each trajectory.
#[wasm_bindgen]
pub fn simulate(
    population: u32,
    initial_infected: u32,
    p: f64,
    generations: u32,
    n_trajectories: u32,
) -> JsValue {
    let gen = generations as usize;

    let row_len = gen + 1;
    let total_rows = row_len * n_trajectories as usize;

    let mut cumulative_infections = vec![0u32; total_rows];
    let mut generation_col = vec![0u32; total_rows];
    let mut trajectory_col = vec![0u32; total_rows];

    for traj in 0..n_trajectories as usize {
        let offset = traj * row_len;
        let seed = (traj + 1) as u64;
        let traj_data = model::trajectory(population, initial_infected, p, seed);

        let mut cum = initial_infected;
        generation_col[offset] = 0;
        trajectory_col[offset] = traj as u32;
        cumulative_infections[offset] = cum as u32;

        for t in 1..=gen {
            cum += traj_data.get(t).copied().unwrap_or(0);
            generation_col[offset + t] = t as u32;
            trajectory_col[offset + t] = traj as u32;
            cumulative_infections[offset + t] = cum as u32;
        }
    }

    let data = ModelOutput::new(total_rows)
        .add_u32("generation", generation_col)
        .add_u32("trajectory", trajectory_col)
        .add_u32("cumulative_infections", cumulative_infections);

    model_outputs([("data", data)])
}
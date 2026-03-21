use cfasim_model::{model_outputs, ModelOutput};
use wasm_bindgen::prelude::*;

/// Simple LCG PRNG
struct Rng(u64);

impl Rng {
    fn new(seed: u32) -> Self {
        Self(seed as u64)
    }

    fn next_f64(&mut self) -> f64 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1);
        (self.0 >> 33) as f64 / (1u64 << 31) as f64
    }

    fn binomial(&mut self, trials: usize, prob: f64) -> usize {
        let mut count = 0;
        for _ in 0..trials {
            if self.next_f64() < prob {
                count += 1;
            }
        }
        count
    }
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
    let n = population as usize;
    let i0 = initial_infected as usize;
    let gen = generations as usize;

    // Each trajectory is padded to `gen + 1` entries
    let row_len = gen + 1;
    let total_rows = row_len * n_trajectories as usize;

    let mut cumulative_infections = vec![0u32; total_rows];
    let mut generation_col = vec![0u32; total_rows];
    let mut trajectory_col = vec![0u32; total_rows];

    for traj in 0..n_trajectories as usize {
        let mut rng = Rng::new((traj + 1) as u32);
        let offset = traj * row_len;

        let mut s = n - i0;
        let mut infected = i0;
        let mut cum = i0;

        generation_col[offset] = 0;
        trajectory_col[offset] = traj as u32;
        cumulative_infections[offset] = cum as u32;

        for t in 1..=gen {
            if infected == 0 {
                // Epidemic over — flat line for remaining generations
                generation_col[offset + t] = t as u32;
                trajectory_col[offset + t] = traj as u32;
                cumulative_infections[offset + t] = cum as u32;
                continue;
            }

            let infection_prob = 1.0 - (1.0 - p).powi(infected as i32);
            let new_infected = rng.binomial(s, infection_prob);

            s -= new_infected;
            cum += new_infected;
            infected = new_infected;

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

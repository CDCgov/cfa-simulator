use cfasim_model::{model_outputs, ModelOutput};
use wasm_bindgen::prelude::*;

/// Reed-Frost epidemic simulation.
/// Runs a stochastic SIR model where each susceptible has an independent
/// probability `p` of being infected by each infectious individual per generation.
#[wasm_bindgen]
pub fn simulate(population: u32, initial_infected: u32, p: f64, seed: u32) -> JsValue {
    let n = population as usize;
    let i0 = initial_infected as usize;
    let max_gen = n + 1;

    // Simple LCG PRNG (good enough for demo, no external crate needed)
    let mut rng_state: u64 = seed as u64;
    let mut next_random = || -> f64 {
        rng_state = rng_state.wrapping_mul(6364136223846793005).wrapping_add(1);
        (rng_state >> 33) as f64 / (1u64 << 31) as f64
    };

    // Binomial sample via repeated Bernoulli trials
    let mut binomial = |trials: usize, prob: f64| -> usize {
        let mut count = 0;
        for _ in 0..trials {
            if next_random() < prob {
                count += 1;
            }
        }
        count
    };

    let mut susceptible = vec![0u32; max_gen];
    let mut infected = vec![0u32; max_gen];
    let mut recovered = vec![0u32; max_gen];
    let mut generation = vec![0u32; max_gen];

    susceptible[0] = n as u32 - i0 as u32;
    infected[0] = i0 as u32;
    recovered[0] = 0;
    generation[0] = 0;

    let mut len = 1;

    for t in 0..n {
        let s = susceptible[t] as usize;
        let i = infected[t] as usize;

        if i == 0 {
            break;
        }

        // Each susceptible escapes all i infectors independently with prob (1-p)^i
        let infection_prob = 1.0 - (1.0 - p).powi(i as i32);
        let new_infected = binomial(s, infection_prob) as u32;

        generation[len] = (t + 1) as u32;
        susceptible[len] = susceptible[t] - new_infected;
        infected[len] = new_infected;
        recovered[len] = recovered[t] + infected[t];
        len += 1;
    }

    susceptible.truncate(len);
    infected.truncate(len);
    recovered.truncate(len);
    generation.truncate(len);

    let trajectory = ModelOutput::new(len)
        .add_u32("generation", generation)
        .add_u32("susceptible", susceptible)
        .add_u32("infected", infected)
        .add_u32("recovered", recovered);

    model_outputs([("trajectory", trajectory)])
}

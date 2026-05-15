mod model;
mod parameters;
mod stats;

use cfasim_model::{model_outputs, ModelOutput};
use wasm_bindgen::prelude::*;

use crate::parameters::Parameters;

/// Stochastic SIR ensemble. Runs `n_simulations` independent realizations
/// (each with seed `seed + i`) and emits one `cumulative_infections_{i}`
/// column per run, plus a single `cumulative_infections_expected` curve
/// from the deterministic SIR ODE. The summary's observed R₀ and attack
/// rate are means over the ensemble.
#[wasm_bindgen]
pub fn simulate(
    infection_rate: f64,
    infectious_period: f64,
    population: u32,
    initial_infections: u32,
    seed: u32,
    max_time: f64,
    n_simulations: u32,
) -> JsValue {
    let base_params = Parameters {
        infection_rate,
        infectious_period,
        population: population as usize,
        initial_infections: initial_infections as usize,
        seed: seed as u64,
        max_time,
    };

    let mut time: Vec<f64> = Vec::new();
    let mut trajectories: Vec<Vec<f64>> = Vec::with_capacity(n_simulations as usize);
    let mut ar_per_run: Vec<f64> = Vec::with_capacity(n_simulations as usize);
    // One R₀ per run: each run's `stats.r0_estimate()` is the mean of its
    // seeds' secondary-infection counts (the textbook within-run R₀
    // definition). We then summarize *across* runs with median + 2.5/97.5
    // quantiles for the CI.
    let mut r0_per_run: Vec<f64> = Vec::with_capacity(n_simulations as usize);
    for i in 0..n_simulations {
        let mut p = base_params.clone();
        p.seed = base_params.seed + i as u64;
        let s = model::run(p);
        let (t, values) = s.timeseries(max_time);
        if i == 0 {
            time = t;
        }
        ar_per_run.push(s.observed_attack_rate(population as usize, initial_infections as usize));
        r0_per_run.push(s.r0_estimate());
        trajectories.push(values);
    }

    let expected = stats::expected_cumulative_incidence(
        infection_rate,
        infectious_period,
        population as usize,
        initial_infections as usize,
        max_time,
    );

    // Expected attack rate is the deterministic trajectory's asymptote
    // (last bin) plus the seeded I₀, divided by N. Reading it from the
    // integrator means the table cell and the chart's "Expected" curve
    // share a single source of truth — and the s₀ < 1 case is handled
    // correctly by the ODE itself.
    let ar_expected = expected
        .last()
        .copied()
        .map(|new_inf| (new_inf + initial_infections as f64) / population as f64)
        .unwrap_or(0.0);
    let r0_expected = stats::expected_r0(infection_rate, infectious_period);

    // 95% credible interval is the 2.5–97.5 percentile range of the per-run
    // values, with the central tendency reported as the linear-interpolation
    // median. Matches cfa-measles-simulator's `_stats`.
    let ar_median = stats::median(&ar_per_run);
    let ar_lo = stats::quantile_nearest(&ar_per_run, 0.025);
    let ar_hi = stats::quantile_nearest(&ar_per_run, 0.975);
    let r0_median = stats::median(&r0_per_run);
    let r0_lo = stats::quantile_nearest(&r0_per_run, 0.025);
    let r0_hi = stats::quantile_nearest(&r0_per_run, 0.975);

    let n = time.len();
    let median = stats::pointwise_median(&trajectories);
    let mut series = ModelOutput::new(n).add_f64("time", time);
    for (i, traj) in trajectories.into_iter().enumerate() {
        series = series.add_f64(&format!("cumulative_infections_{i}"), traj);
    }
    series = series
        .add_f64("cumulative_infections_median", median)
        .add_f64("cumulative_infections_expected", expected);

    let summary = ModelOutput::new(1)
        .add_f64("r0_observed_median", vec![r0_median])
        .add_f64("r0_observed_lo", vec![r0_lo])
        .add_f64("r0_observed_hi", vec![r0_hi])
        .add_f64("r0_expected", vec![r0_expected])
        .add_f64("attack_rate_observed_median", vec![ar_median])
        .add_f64("attack_rate_observed_lo", vec![ar_lo])
        .add_f64("attack_rate_observed_hi", vec![ar_hi])
        .add_f64("attack_rate_expected", vec![ar_expected]);

    model_outputs([("series", series), ("summary", summary)])
}

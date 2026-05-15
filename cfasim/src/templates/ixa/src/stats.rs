//! Per-time-bin incidence stats. Hides the `define_data_plugin!` plumbing
//! so the model just calls `record_infection` on each new infection and
//! `cumulative_timeseries` at the end of the run.

use std::collections::BTreeMap;

use ixa::define_data_plugin;
use ixa::prelude::*;

#[derive(Default)]
struct Stats {
    new_infections_per_bin: BTreeMap<usize, usize>,
}

define_data_plugin!(StatsPlugin, Stats, Stats::default());

/// Record one new infection at `time`, bucketed into an integer time bin.
pub fn record_infection(ctx: &mut Context, time: f64) {
    let bin = time.floor().max(0.0) as usize;
    *ctx.get_data_mut(StatsPlugin)
        .new_infections_per_bin
        .entry(bin)
        .or_insert(0) += 1;
}

/// Forward-fill the recorded incidence into a cumulative time series over
/// integer bins `[0, max_time]`. Returns `(time, cumulative_infections)`.
pub fn cumulative_timeseries(ctx: &Context, max_time: f64) -> (Vec<f64>, Vec<f64>) {
    let stats = ctx.get_data(StatsPlugin);
    let max_t = max_time.floor().max(0.0) as usize;
    let mut time = Vec::with_capacity(max_t + 1);
    let mut values = Vec::with_capacity(max_t + 1);
    let mut cum = 0usize;
    for t in 0..=max_t {
        if let Some(&c) = stats.new_infections_per_bin.get(&t) {
            cum += c;
        }
        time.push(t as f64);
        values.push(cum as f64);
    }
    (time, values)
}

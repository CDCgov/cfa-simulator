use std::collections::BTreeMap;

use crate::model::PersonId;

mod analytic;
pub use analytic::{expected_cumulative_incidence, expected_r0};

#[derive(Clone, Debug)]
pub struct ModelStats {
    cum_incidence: usize,
    cum_incidence_timeseries: BTreeMap<usize, usize>,
    current_infected: usize,
    /// IDs of the people seeded as infectious at t = 0. Their secondary
    /// counts (read off each Person's `SecondaryInfections` property after
    /// the run finishes) are the cleanest R₀ estimators because they were
    /// infectious from t = 0 with a (nearly) fully susceptible population.
    initial_seeds: Vec<PersonId>,
    /// R₀ estimate for this run: the mean of seed secondary-infection
    /// counts. Populated by `model::run` after `ctx.execute()`. `NaN` if
    /// there were no seeds.
    r0_estimate: f64,
}

impl ModelStats {
    pub fn new(initial_infections: usize) -> Self {
        Self {
            cum_incidence: 0,
            cum_incidence_timeseries: BTreeMap::from([(0, 0)]),
            current_infected: initial_infections,
            initial_seeds: Vec::with_capacity(initial_infections),
            r0_estimate: f64::NAN,
        }
    }

    pub fn record_recovery(&mut self) {
        debug_assert!(self.current_infected > 0, "recovery with no infected");
        self.current_infected -= 1;
    }

    pub fn record_infection(&mut self, current_t: f64) {
        self.cum_incidence += 1;
        self.current_infected += 1;
        let t_floor = current_t.floor().max(0.0) as usize;
        let snapshot = self.cum_incidence;
        self.cum_incidence_timeseries
            .entry(t_floor)
            .and_modify(|e| *e = snapshot)
            .or_insert(snapshot);
    }

    #[allow(dead_code)]
    pub fn cum_incidence(&self) -> usize {
        self.cum_incidence
    }

    #[allow(dead_code)]
    pub fn current_infected(&self) -> usize {
        self.current_infected
    }

    /// Mark `p` as one of the initial seeded infectious people.
    pub fn record_seed(&mut self, p: PersonId) {
        self.initial_seeds.push(p);
    }

    /// PersonIds of the initially seeded infectious people. `model::run`
    /// reads each seed's `SecondaryInfections` property after the run to
    /// finalize the R₀ estimate.
    pub fn initial_seeds(&self) -> &[PersonId] {
        &self.initial_seeds
    }

    /// Set the R₀ estimate for this run (mean of seed secondary counts).
    pub fn set_r0_estimate(&mut self, r0: f64) {
        self.r0_estimate = r0;
    }

    /// R₀ estimate for this run, or `NaN` if `model::run` hasn't been
    /// called yet / there were no seeds.
    pub fn r0_estimate(&self) -> f64 {
        self.r0_estimate
    }

    /// Total ever infected = initial seeded infections + new infections
    /// recorded during the run. Initial seeds are not counted in
    /// `cum_incidence`, so callers must supply them.
    pub fn observed_attack_rate(&self, population: usize, initial_infections: usize) -> f64 {
        if population == 0 {
            return 0.0;
        }
        (initial_infections + self.cum_incidence) as f64 / population as f64
    }

    // Forward-fill the cumulative incidence over integer time bins so the
    // resulting series renders as a monotonically increasing step curve.
    pub fn timeseries(&self, max_time: f64) -> (Vec<f64>, Vec<f64>) {
        let max_t = max_time.floor().max(0.0) as usize;
        let mut time = Vec::with_capacity(max_t + 1);
        let mut values = Vec::with_capacity(max_t + 1);
        let mut current = 0usize;
        for t in 0..=max_t {
            if let Some(&v) = self.cum_incidence_timeseries.get(&t) {
                current = v;
            }
            time.push(t as f64);
            values.push(current as f64);
        }
        (time, values)
    }
}

/// Arithmetic mean of a 1-D sample. Skips non-finite values; returns
/// `NaN` for an empty (or all-non-finite) input.
pub fn mean(values: &[f64]) -> f64 {
    let mut sum = 0.0;
    let mut n = 0usize;
    for &v in values {
        if v.is_finite() {
            sum += v;
            n += 1;
        }
    }
    if n == 0 {
        f64::NAN
    } else {
        sum / n as f64
    }
}

/// Median of a 1-D sample using linear interpolation. Skips non-finite
/// values; returns `NaN` for an empty (or all-non-finite) input. Matches
/// `numpy.median` / Polars' `Series.median` (which both default to linear).
pub fn median(values: &[f64]) -> f64 {
    let mut sorted: Vec<f64> = values.iter().copied().filter(|v| v.is_finite()).collect();
    if sorted.is_empty() {
        return f64::NAN;
    }
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = sorted.len();
    if n % 2 == 1 {
        sorted[n / 2]
    } else {
        (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0
    }
}

/// Quantile of a 1-D sample using nearest-index interpolation
/// (`sorted[round(q · (n − 1))]`). Matches Polars'
/// `Series.quantile(q, "nearest")`, which uses round-half-away-from-zero.
/// Skips non-finite values; returns `NaN` for an empty input.
///
/// Note: Polars and numpy differ on the default for `median` vs `quantile`
/// — `median` defaults to linear, `quantile` defaults to nearest — so
/// `quantile_nearest(values, 0.5)` and `median(values)` can disagree for
/// even-length samples. This crate keeps both helpers separate to match
/// that convention (see cfa-measles-simulator's `metapop.__init__`).
pub fn quantile_nearest(values: &[f64], q: f64) -> f64 {
    let mut sorted: Vec<f64> = values.iter().copied().filter(|v| v.is_finite()).collect();
    if sorted.is_empty() {
        return f64::NAN;
    }
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let pos = q * (sorted.len() - 1) as f64;
    let idx = (pos + 0.5) as usize;
    sorted[idx.min(sorted.len() - 1)]
}

/// Pointwise median across an ensemble of equal-length trajectories. Returns
/// a vector of length `trajectories[0].len()` (or empty if the input is
/// empty). Non-finite values are skipped per bin; if a bin has no finite
/// values across runs, the median is `NaN`.
pub fn pointwise_median(trajectories: &[Vec<f64>]) -> Vec<f64> {
    let Some(first) = trajectories.first() else {
        return Vec::new();
    };
    let len = first.len();
    let mut out = Vec::with_capacity(len);
    let mut buf: Vec<f64> = Vec::with_capacity(trajectories.len());
    for i in 0..len {
        buf.clear();
        for t in trajectories {
            if let Some(&v) = t.get(i) {
                if v.is_finite() {
                    buf.push(v);
                }
            }
        }
        buf.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let n = buf.len();
        out.push(match n {
            0 => f64::NAN,
            _ if n % 2 == 1 => buf[(n - 1) / 2],
            _ => (buf[n / 2 - 1] + buf[n / 2]) / 2.0,
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_incidence_and_recovery() {
        let mut s = ModelStats::new(5);
        s.record_infection(1.2);
        s.record_infection(2.8);
        assert_eq!(s.cum_incidence(), 2);
        assert_eq!(s.current_infected(), 7);
        s.record_recovery();
        assert_eq!(s.current_infected(), 6);
    }

    #[test]
    fn timeseries_forward_fills_between_bins() {
        let mut s = ModelStats::new(0);
        s.record_infection(1.0);
        s.record_infection(3.0);
        let (time, values) = s.timeseries(5.0);
        assert_eq!(time, vec![0.0, 1.0, 2.0, 3.0, 4.0, 5.0]);
        assert_eq!(values, vec![0.0, 1.0, 1.0, 2.0, 2.0, 2.0]);
    }

    #[test]
    fn mean_skips_nan_and_handles_empty() {
        assert_eq!(mean(&[1.0, 2.0, 3.0]), 2.0);
        assert_eq!(mean(&[1.0, f64::NAN, 3.0]), 2.0);
        assert!(mean(&[]).is_nan());
        assert!(mean(&[f64::NAN]).is_nan());
    }

    #[test]
    fn median_handles_even_odd_and_nan() {
        assert_eq!(median(&[1.0]), 1.0);
        assert_eq!(median(&[1.0, 2.0, 3.0]), 2.0);
        assert_eq!(median(&[1.0, 2.0, 3.0, 4.0]), 2.5);
        assert!(median(&[]).is_nan());
        assert!(median(&[f64::NAN]).is_nan());
        // NaN is skipped; median of the finite values.
        assert_eq!(median(&[1.0, f64::NAN, 3.0]), 2.0);
    }

    #[test]
    fn quantile_nearest_matches_polars_rules() {
        // For n=5, sorted indices 0..=4. q·(n-1) = q·4.
        // q=0.5  → pos=2.0, idx=round(2.0+0.5)=2 → sorted[2] = 3.
        // q=0.025 → pos=0.1, idx=round(0.6)=0   → sorted[0] = 1.
        // q=0.975 → pos=3.9, idx=round(4.4)=4   → sorted[4] = 5.
        let v = [1.0, 2.0, 3.0, 4.0, 5.0];
        assert_eq!(quantile_nearest(&v, 0.5), 3.0);
        assert_eq!(quantile_nearest(&v, 0.025), 1.0);
        assert_eq!(quantile_nearest(&v, 0.975), 5.0);
        assert!(quantile_nearest(&[], 0.5).is_nan());
    }

    #[test]
    fn pointwise_median_picks_middle_or_averages_pair() {
        // Odd N at each time bin: pick the middle.
        let trajectories = vec![vec![0.0, 1.0, 5.0], vec![0.0, 3.0, 2.0], vec![0.0, 2.0, 4.0]];
        assert_eq!(pointwise_median(&trajectories), vec![0.0, 2.0, 4.0]);

        // Even N: average the two middles.
        let trajectories = vec![vec![1.0, 10.0], vec![3.0, 20.0], vec![5.0, 30.0], vec![7.0, 40.0]];
        assert_eq!(pointwise_median(&trajectories), vec![4.0, 25.0]);

        // Empty input: empty output.
        assert!(pointwise_median(&[]).is_empty());

        // NaN at one position is skipped; median computed over the rest.
        let trajectories = vec![vec![1.0, f64::NAN], vec![3.0, 2.0], vec![5.0, 4.0]];
        assert_eq!(pointwise_median(&trajectories), vec![3.0, 3.0]);
    }

    #[test]
    fn observed_attack_rate_counts_seeds_and_incidence() {
        let mut s = ModelStats::new(5);
        s.record_infection(1.0);
        s.record_infection(2.0);
        s.record_infection(3.0);
        assert!((s.observed_attack_rate(100, 5) - 0.08).abs() < 1e-12);
        assert_eq!(s.observed_attack_rate(0, 5), 0.0);
    }
}

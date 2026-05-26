/// Theoretical R₀ for a homogeneous SIR: β · D.
pub fn expected_r0(infection_rate: f64, infectious_period: f64) -> f64 {
    infection_rate * infectious_period
}

/// Deterministic SIR model
/// dS/dt = −β·S·I/N,
/// dI/dt =  β·S·I/N − γ·I,
/// with β = `infection_rate`, γ = 1/`infectious_period`, S(0) = N − I₀,
/// I(0) = I₀, using RK4 at a 0.01 step. Returned value at time `t` is
/// `S(0) − S(t)` (new infections since t=0), matching the observed
/// `cum_incidence` so the two curves are directly comparable.
pub fn expected_cumulative_incidence(
    infection_rate: f64,
    infectious_period: f64,
    population: usize,
    initial_infections: usize,
    max_time: f64,
) -> Vec<f64> {
    let n = population as f64;
    let i0 = initial_infections as f64;
    let s0 = (n - i0).max(0.0);
    let beta = infection_rate;
    let gamma = if infectious_period > 0.0 {
        1.0 / infectious_period
    } else {
        0.0
    };

    let max_t = max_time.floor().max(0.0) as usize;
    let mut out = Vec::with_capacity(max_t + 1);
    out.push(0.0);

    if n <= 0.0 || max_t == 0 {
        return out;
    }

    let steps_per_unit: usize = 100;
    let dt = 1.0 / steps_per_unit as f64;
    let derivs = |s: f64, i: f64| {
        let inf = beta * s * i / n;
        (-inf, inf - gamma * i)
    };

    let mut s = s0;
    let mut i = i0;
    for _t in 1..=max_t {
        for _ in 0..steps_per_unit {
            let (k1s, k1i) = derivs(s, i);
            let (k2s, k2i) = derivs(s + 0.5 * dt * k1s, i + 0.5 * dt * k1i);
            let (k3s, k3i) = derivs(s + 0.5 * dt * k2s, i + 0.5 * dt * k2i);
            let (k4s, k4i) = derivs(s + dt * k3s, i + dt * k3i);
            s += dt * (k1s + 2.0 * k2s + 2.0 * k3s + k4s) / 6.0;
            i += dt * (k1i + 2.0 * k2i + 2.0 * k3i + k4i) / 6.0;
        }
        out.push((s0 - s).max(0.0));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expected_r0_is_beta_times_duration() {
        assert!((expected_r0(0.5, 3.0) - 1.5).abs() < 1e-12);
    }

    #[test]
    fn expected_cumulative_incidence_shape_and_final_size() {
        let pop = 10_000usize;
        let i0 = 5usize;
        let beta = 0.5;
        let d = 3.0;
        let traj = expected_cumulative_incidence(beta, d, pop, i0, 100.0);
        assert_eq!(traj.len(), 101);
        assert_eq!(traj[0], 0.0);
        for w in traj.windows(2) {
            assert!(w[1] >= w[0] - 1e-9);
        }
        // At t → ∞ the trajectory must satisfy the SIR final-size identity
        // 1 − z = s₀ · exp(−R₀ · z), with z = (traj_final + I₀)/N and
        // s₀ = (N − I₀)/N. 100 time units is well past convergence for
        // R₀ = 1.5, so the last bin is effectively the asymptote.
        let r0 = expected_r0(beta, d);
        let s0 = (pop - i0) as f64 / pop as f64;
        let z = (traj[100] + i0 as f64) / pop as f64;
        let lhs = 1.0 - z;
        let rhs = s0 * (-r0 * z).exp();
        // Tolerance accommodates the residual I(t) / N at t = 100; the true
        // asymptote requires t → ∞.
        assert!((lhs - rhs).abs() < 1e-3);
    }

    #[test]
    fn expected_cumulative_incidence_is_zero_below_threshold() {
        // R₀ = β · D = 0.5 · 1.0 = 0.5 < 1: no outbreak. Tiny seed-driven
        // growth only.
        let traj = expected_cumulative_incidence(0.5, 1.0, 10_000, 5, 100.0);
        assert!(traj[100] < 10.0);
    }
}

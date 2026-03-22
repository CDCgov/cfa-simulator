use memoize::memoize;
use ordered_float::OrderedFloat;
use probability::distribution::{Binomial as BinomialPMF, Discrete};
use rand::SeedableRng;
use rand_distr::Distribution;

/// Probability mass function for Reed-Frost epidemic final sizes
pub fn pmf(s_inf: usize, s: usize, i: usize, p: f64) -> f64 {
    pmf_hash(s_inf, s, i, OrderedFloat(p))
}

#[memoize]
fn pmf_hash(s_inf: usize, s: usize, i: usize, p: OrderedFloat<f64>) -> f64 {
    if (i == 0) & (s_inf == s) {
        1.0
    } else if ((i == 0) & (s_inf != s)) | ((i > 0) & (s < s_inf)) {
        0.0
    } else {
        (0..=(s - s_inf))
            .map(|j| transition_probability(j, s, i, p) * pmf_hash(s_inf, s - j, j, p))
            .sum()
    }
}

/// Reed-Frost transition probability. Given an epidemic with `s` susceptibles,
/// `i` infected, and a probability `p` of transmission per contact, what is
/// the probability that there will be `x` infected in the next generation?
#[memoize]
fn transition_probability(x: usize, s: usize, i: usize, p: OrderedFloat<f64>) -> f64 {
    BinomialPMF::new(s, 1.0 - (1.0 - p.into_inner()).powi(i as i32)).mass(x)
}

pub fn trajectory(s0: u32, i0: u32, p: f64, seed: u64) -> Vec<u32> {
    let mut rng = rand::rngs::SmallRng::seed_from_u64(seed);

    let mut it = vec![0u32; s0 as usize + 1];
    it[0] = i0;

    let mut s = s0;

    for t in 0..s0 as usize {
        if it[t] == 0 {
            break;
        }

        let next_i = rand_distr::Binomial::new(s as u64, 1.0 - (1.0 - p).powi(it[t] as i32))
            .unwrap()
            .sample(&mut rng) as u32;

        it[t + 1] = next_i;
        s -= next_i;
    }

    it
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_approx_eq::assert_approx_eq;

    #[test]
    fn test_pdf_trivial() {
        assert_eq!(pmf(10, 10, 0, 0.5), 1.0);
        assert_eq!(pmf(5, 10, 0, 0.5), 0.0);
        assert_eq!(pmf(10, 5, 0, 0.5), 0.0);
        assert_eq!(pmf(10, 0, 1, 0.5), 0.0);
    }

    #[test]
    fn test_pdf_cases() {
        assert_approx_eq!(pmf(5, 10, 1, 0.05), 0.0152347);
        assert_approx_eq!(pmf(3, 12, 2, 0.10), 0.1059780);
    }

    #[test]
    fn test_trajectory_length() {
        let s0 = 20u32;
        let traj = trajectory(s0, 2, 0.5, 42);
        assert_eq!(traj.len(), s0 as usize + 1);
    }
}

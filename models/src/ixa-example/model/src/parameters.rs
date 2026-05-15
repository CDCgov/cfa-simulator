use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Parameters {
    // New infections per unit time per infectious individual. Related to R0
    // as `infection_rate = R0 / infectious_period`.
    pub infection_rate: f64,
    pub infectious_period: f64,
    pub population: usize,
    pub initial_infections: usize,
    pub seed: u64,
    pub max_time: f64,
}

impl Default for Parameters {
    fn default() -> Self {
        Self {
            infection_rate: 0.5,
            infectious_period: 3.0,
            population: 10000,
            initial_infections: 5,
            seed: 0,
            max_time: 100.0,
        }
    }
}

use cfasim_model::{export, ModelOutput, Outputs};
use serde::Deserialize;

fn step(state: f64, rate: f64) -> f64 {
    state + rate
}

// The numerical logic, apart from the inputs and outputs that wrap it.
fn compute(steps: u32, rate: f64) -> (Vec<f64>, Vec<f64>) {
    let n = steps as usize;
    let mut time = Vec::with_capacity(n);
    let mut values = Vec::with_capacity(n);
    let mut state = 0.0;
    for t in 0..steps {
        time.push(t as f64);
        values.push(state);
        state = step(state, rate);
    }
    (time, values)
}

/// Inputs of `simulate`, matched by name to the params object in `App.vue`.
#[derive(Deserialize)]
struct SimulateInputs {
    steps: u32,
    rate: f64,
}

fn simulate(inputs: SimulateInputs) -> Outputs {
    let (time, values) = compute(inputs.steps, inputs.rate);

    let series = ModelOutput::new(time.len())
        .add_f64("time", time)
        .add_f64("values", values);

    Outputs::new().add("series", series)
}

// Makes `simulate` callable from the page: `useOutputs("simulate", params)`.
// List every exported function here, e.g. `export!(simulate, summarize)`.
export!(simulate);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_step() {
        assert_eq!(step(0.0, 3.0), 3.0);
        assert_eq!(step(5.0, 2.5), 7.5);
    }

    #[test]
    fn test_compute_shape() {
        let (time, values) = compute(5, 2.0);
        assert_eq!(time.len(), 5);
        assert_eq!(values.len(), 5);
    }

    #[test]
    fn test_simulate_outputs() {
        let outputs = simulate(SimulateInputs {
            steps: 5,
            rate: 2.0,
        });
        assert_eq!(outputs.names(), ["series"]);
        assert_eq!(outputs.tables()[0].1.len(), 5);
    }

    #[test]
    fn test_compute_values() {
        let (time, values) = compute(4, 3.0);
        assert_eq!(time, vec![0.0, 1.0, 2.0, 3.0]);
        assert_eq!(values, vec![0.0, 3.0, 6.0, 9.0]);
    }
}

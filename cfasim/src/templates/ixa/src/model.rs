//! A stochastic SIR outbreak with homogeneous mixing, built on the
//! transmission loop from ixa's `core_epi` module.

use ixa::core_epi::prelude::*;
use ixa::prelude::*;
use rand_distr::Exp;
use serde::{Deserialize, Serialize};

use crate::stats;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Parameters {
    pub population: usize,
    pub initial_infections: usize,
    /// Transmission attempts per day while infectious. With homogeneous
    /// mixing, R0 is `infectiousness * infectious_period`.
    pub infectiousness: f64,
    /// Mean infectious period in days.
    pub infectious_period: f64,
    pub max_time: f64,
}

impl Parameters {
    fn validate(&self) -> Result<(), String> {
        if !(self.infectiousness.is_finite() && self.infectiousness >= 0.0) {
            return Err("infectiousness must be zero or more".to_string());
        }
        if !(self.infectious_period.is_finite() && self.infectious_period > 0.0) {
            return Err("infectious period must be greater than zero".to_string());
        }
        if !(self.max_time.is_finite() && self.max_time >= 0.0) {
            return Err("max time must be zero or more".to_string());
        }
        Ok(())
    }
}

define_global_property!(Params, Parameters);
define_rng!(InfectiousPeriodRng);
define_entity!(Person);
define_property!(
    enum InfectionStatus {
        Susceptible,
        Infectious,
        Recovered,
    },
    Person,
    default_const = InfectionStatus::Susceptible
);

/// Marker type the `core_epi` traits are implemented for. Implementing them
/// for a second marker adds a second pathogen.
struct Pathogen;

impl InfectionManager<Pathogen> for Context {
    type Entity = Person;
    type Details = ();

    /// How infectious a person is over the course of their infection: a
    /// constant rate for an exponentially distributed infectious period.
    fn draw_infectiousness_rate_fn(&mut self, _person: PersonId, _details: &()) -> RateAssignment {
        let params = self.get_global_property_value(Params).unwrap();
        let duration = self.sample_distr(
            InfectiousPeriodRng,
            Exp::new(1.0 / params.infectious_period).unwrap(),
        );
        ConstantRateFn::new(params.infectiousness, duration).into()
    }

    /// Called for every new infection, seeds included. `core_epi` has no
    /// disease states of its own, so the model tracks them here.
    fn on_infected(&mut self, _infector: Option<PersonId>, infectee: PersonId, _details: ()) {
        self.set_property(infectee, InfectionStatus::Infectious);
        let now = self.get_current_time();
        stats::record_infection(self, now);

        let recovery_time = self.infectiousness_end_time(infectee).unwrap();
        self.add_plan(recovery_time, move |context| {
            context.set_property(infectee, InfectionStatus::Recovered);
        });
    }
}

// The defaults give homogeneous mixing: each attempt contacts someone else
// uniformly at random, and a person can be infected only once. Override
// `sample_contact` or `base_susceptibility` to change that.
impl TransmissionManager<Pathogen> for Context {}

/// Runs one realization and returns `(time, cumulative_infections)`.
pub fn run(params: Parameters, seed: u64) -> Result<(Vec<f64>, Vec<f64>), String> {
    params.validate()?;
    let max_time = params.max_time;
    let population = params.population;
    let initial_infections = params.initial_infections;

    let mut context = Context::new();
    context.set_global_property_value(Params, params).unwrap();
    context.init_random(seed);

    for _ in 0..population {
        context.add_entity(Person).unwrap();
    }
    context.setup_transmission_loop();
    context.seed_infections(Person, initial_infections);

    context.add_plan(max_time, |context| context.shutdown());
    context.execute();

    Ok(stats::cumulative_timeseries(&context, max_time))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Enough seeds that the outbreak dying out by chance is not a concern.
    fn params() -> Parameters {
        Parameters {
            population: 500,
            initial_infections: 20,
            infectiousness: 0.4,
            infectious_period: 5.0,
            max_time: 100.0,
        }
    }

    #[test]
    fn outbreak_spreads_beyond_the_seeds() {
        let (time, cumulative) = run(params(), 1).unwrap();
        assert_eq!(time.len(), 101);
        // Day 0 counts the seeds plus anyone they infect before day 1.
        assert!(cumulative[0] >= 20.0);
        let total = *cumulative.last().unwrap();
        assert!(total > 100.0 && total <= 500.0, "total infections: {total}");
    }

    #[test]
    fn nobody_is_infected_without_infectiousness() {
        let no_transmission = Parameters {
            infectiousness: 0.0,
            ..params()
        };
        let (_, cumulative) = run(no_transmission, 1).unwrap();
        assert_eq!(*cumulative.last().unwrap(), 20.0);
    }

    #[test]
    fn same_seed_gives_the_same_run() {
        assert_eq!(run(params(), 7), run(params(), 7));
        assert_ne!(run(params(), 7), run(params(), 8));
    }

    #[test]
    fn invalid_parameters_are_an_error() {
        let no_infectious_period = Parameters {
            infectious_period: 0.0,
            ..params()
        };
        assert!(run(no_infectious_period, 1).is_err());
    }
}

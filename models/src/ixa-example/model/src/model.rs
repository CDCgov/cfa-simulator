use ixa::prelude::*;
use ixa::{
    define_data_plugin, define_entity, define_global_property, define_property, define_rng,
    impl_property, Context,
};
use rand_distr::Exp;

use crate::parameters::Parameters;
use crate::stats::ModelStats;

define_global_property!(Params, Parameters);

define_rng!(InfectionRng);
define_rng!(RecoveryRng);

define_data_plugin!(ModelStatsPlugin, ModelStats, |context| {
    let params = context.get_global_property_value(Params).unwrap();
    ModelStats::new(params.initial_infections)
});

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

/// Per-person count of successful secondary infections caused by this
/// person. Incremented on every S → I transmission whose infector is
/// known. Stored as an entity property so each Person carries their own
/// counter — read off the initially seeded individuals at the end of a
/// run to estimate R₀.
#[derive(Copy, Clone, Debug, Default, PartialEq, Eq, Hash)]
pub struct SecondaryInfections(pub u32);
impl_property!(SecondaryInfections, Person, default_const = SecondaryInfections(0));

trait InfectionLoop {
    fn get_params(&self) -> &Parameters;
    fn get_stats(&self) -> &ModelStats;
    #[cfg_attr(not(test), allow(dead_code))]
    fn infected_people(&self) -> usize;
    fn random_person(&mut self) -> Option<PersonId>;
    fn infect_person(&mut self, p: PersonId, t: Option<f64>, infector: Option<PersonId>);
    fn recover_person(&mut self, p: PersonId);
    fn schedule_recovery(&mut self, p: PersonId);
    fn schedule_next_infection_attempt(&mut self, infector: PersonId);
    fn setup(&mut self);
}

impl InfectionLoop for Context {
    fn get_params(&self) -> &Parameters {
        self.get_global_property_value(Params).unwrap()
    }
    fn get_stats(&self) -> &ModelStats {
        self.get_data(ModelStatsPlugin)
    }
    fn infected_people(&self) -> usize {
        self.query_entity_count(with!(Person, InfectionStatus::Infectious))
    }
    fn random_person(&mut self) -> Option<PersonId> {
        self.sample_entity(InfectionRng, Person)
    }
    fn infect_person(&mut self, p: PersonId, t: Option<f64>, infector: Option<PersonId>) {
        if self.get_property::<_, InfectionStatus>(p) != InfectionStatus::Susceptible {
            return;
        }
        self.set_property(p, InfectionStatus::Infectious);
        if let Some(current_t) = t {
            self.get_data_mut(ModelStatsPlugin)
                .record_infection(current_t);
        }
        if let Some(src) = infector {
            let prev = self.get_property::<_, SecondaryInfections>(src).0;
            self.set_property(src, SecondaryInfections(prev + 1));
        }
    }
    fn recover_person(&mut self, p: PersonId) {
        self.set_property(p, InfectionStatus::Recovered);
        self.get_data_mut(ModelStatsPlugin).record_recovery();
    }
    fn schedule_recovery(&mut self, p: PersonId) {
        // Each infected person draws their own recovery time from
        // Exp(1 / infectious_period). This matches the per-person recovery
        // scheduling in ixa-epi-covid (`schedule_recovery`) — the previous
        // implementation drew a single global recovery event against a
        // pooled rate and then picked a random infected person to recover.
        let infectious_period = self.get_params().infectious_period;
        let dt = self.sample_distr(RecoveryRng, Exp::new(1.0 / infectious_period).unwrap());
        let recovery_time = self.get_current_time() + dt;
        self.add_plan(recovery_time, move |context| {
            if context.get_property::<_, InfectionStatus>(p) == InfectionStatus::Infectious {
                context.recover_person(p);
            }
        });
    }
    fn schedule_next_infection_attempt(&mut self, infector: PersonId) {
        // Each infectious person forecasts their own next transmission attempt
        // from Exp(infection_rate). When the plan fires, if they're still
        // infectious we pick a uniformly random target; if susceptible we
        // infect them, then schedule the next attempt. This is the homogeneous
        // analogue of ixa-epi-covid's `schedule_next_forecasted_infection`.
        let infection_rate = self.get_params().infection_rate;
        let dt = self.sample_distr(InfectionRng, Exp::new(infection_rate).unwrap());
        let next_time = self.get_current_time() + dt;
        self.add_plan(next_time, move |context| {
            if context.get_property::<_, InfectionStatus>(infector) != InfectionStatus::Infectious {
                return;
            }
            if let Some(target) = context.random_person() {
                let now = context.get_current_time();
                context.infect_person(target, Some(now), Some(infector));
            }
            context.schedule_next_infection_attempt(infector);
        });
    }
    fn setup(&mut self) {
        let &Parameters {
            population,
            initial_infections,
            seed,
            max_time,
            ..
        } = self.get_params();
        self.init_random(seed);
        self.index_property::<Person, InfectionStatus>();

        // When someone becomes infectious, they schedule their own recovery
        // and their own next infection attempt — the simulation runs purely
        // off these per-person plans, with no global next-event sampling.
        self.subscribe_to_event(
            |context, event: PropertyChangeEvent<Person, InfectionStatus>| {
                if event.current != InfectionStatus::Infectious {
                    return;
                }
                context.schedule_recovery(event.entity_id);
                context.schedule_next_infection_attempt(event.entity_id);
            },
        );

        for _ in 0..population {
            self.add_entity(Person).unwrap();
        }

        let sampled: Vec<PersonId> = self.sample_entities(
            InfectionRng,
            with!(Person, InfectionStatus::Susceptible),
            initial_infections,
        );
        for p in sampled {
            self.get_data_mut(ModelStatsPlugin).record_seed(p);
            self.infect_person(p, None, None);
        }

        self.add_plan(max_time, |context| {
            context.shutdown();
        });
    }
}

pub fn run(params: Parameters) -> ModelStats {
    let mut ctx = Context::new();
    ctx.set_global_property_value(Params, params).unwrap();
    ctx.setup();
    ctx.execute();

    // R₀ estimate for this run: the *mean* of seed secondary-infection
    // counts (textbook definition: R₀ = E[secondary infections]). Read
    // each seed's `SecondaryInfections` property and average.
    let seeds: Vec<PersonId> = ctx.get_stats().initial_seeds().to_vec();
    let counts: Vec<f64> = seeds
        .iter()
        .map(|&p| ctx.get_property::<_, SecondaryInfections>(p).0 as f64)
        .collect();
    let r0 = crate::stats::mean(&counts);

    let mut stats = ctx.get_stats().clone();
    stats.set_r0_estimate(r0);
    stats
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seeds_initial_infections() {
        let mut ctx = Context::new();
        ctx.set_global_property_value(Params, Parameters::default())
            .unwrap();
        ctx.setup();
        assert_eq!(ctx.infected_people(), 5);
    }

    #[test]
    fn run_returns_nonzero_incidence() {
        let stats = run(Parameters::default());
        assert!(
            stats.cum_incidence() > 0,
            "default params should produce some infections"
        );
    }
}

use ixa::prelude::*;
use ixa::{define_entity, define_global_property, define_property, define_rng, Context};
use rand_distr::Exp;
use serde::{Deserialize, Serialize};

use crate::stats;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Parameters {
    pub infection_rate: f64,
    pub population: usize,
    pub max_time: f64,
}

define_global_property!(Params, Parameters);
define_rng!(MainRng);
define_entity!(Person);
define_property!(
    enum Status {
        Susceptible,
        Infected,
    },
    Person,
    default_const = Status::Susceptible
);

/// Schedule this person's next transmission attempt. When the plan fires,
/// pick a random target; if susceptible, infect them.
fn schedule_next_attempt(ctx: &mut Context, infector: PersonId) {
    let rate = ctx
        .get_global_property_value(Params)
        .unwrap()
        .infection_rate;
    let dt = ctx.sample_distr(MainRng, Exp::new(rate).unwrap());
    let t = ctx.get_current_time() + dt;
    ctx.add_plan(t, move |ctx| {
        if let Some(target) = ctx.sample_entity(MainRng, Person) {
            if ctx.get_property::<_, Status>(target) == Status::Susceptible {
                ctx.set_property(target, Status::Infected);
            }
        }
        schedule_next_attempt(ctx, infector);
    });
}

pub fn run(params: Parameters, seed: u64) -> (Vec<f64>, Vec<f64>) {
    let max_time = params.max_time;
    let population = params.population;

    let mut ctx = Context::new();
    ctx.set_global_property_value(Params, params).unwrap();
    ctx.init_random(seed);
    ctx.index_property::<Person, Status>();

    // When someone becomes infected, record it and let them start transmitting.
    ctx.subscribe_to_event(|ctx, event: PropertyChangeEvent<Person, Status>| {
        if event.current != Status::Infected {
            return;
        }
        let now = ctx.get_current_time();
        stats::record_infection(ctx, now);
        schedule_next_attempt(ctx, event.entity_id);
    });

    for _ in 0..population {
        ctx.add_entity(Person).unwrap();
    }
    if let Some(p) = ctx.sample_entity(MainRng, Person) {
        ctx.set_property(p, Status::Infected);
    }
    ctx.add_plan(max_time, |ctx| ctx.shutdown());
    ctx.execute();

    stats::cumulative_timeseries(&ctx, max_time)
}

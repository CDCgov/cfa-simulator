//! A tasks binary with every kind of task the server has to handle; the
//! `cfasim serve` integration tests run it as their worker.

use std::thread::sleep;
use std::time::Duration;

use cfasim_model::tasks::{Context, Result, Tasks};
use cfasim_model::{ModelOutput, Outputs};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(default)]
struct EchoInputs {
    n: u32,
    label: String,
}

impl Default for EchoInputs {
    fn default() -> Self {
        Self {
            n: 3,
            label: "x".into(),
        }
    }
}

fn echo(ctx: &mut Context, inputs: EchoInputs) -> Result<Outputs> {
    ctx.progress(0.5, "halfway");
    let i: Vec<u32> = (0..inputs.n).collect();
    let v: Vec<f64> = i.iter().map(|x| *x as f64 * 1.5).collect();
    std::fs::write(
        ctx.run_dir().join(format!("{}.txt", inputs.label)),
        "custom output\n",
    )?;
    Ok(Outputs::new().add(
        "series",
        ModelOutput::new(i.len()).add_u32("i", i).add_f64("v", v),
    ))
}

#[derive(Serialize, Deserialize)]
#[serde(default)]
struct SlowInputs {
    steps: u32,
    delay: f64,
}

impl Default for SlowInputs {
    fn default() -> Self {
        Self {
            steps: 50,
            delay: 0.2,
        }
    }
}

fn slow(ctx: &mut Context, inputs: SlowInputs) -> Result<Outputs> {
    for i in 0..inputs.steps {
        ctx.progress(f64::from(i) / f64::from(inputs.steps), &format!("step {i}"));
        if i == 1 {
            let partial = ModelOutput::new(2).add_u32("i", vec![0, 1]);
            ctx.emit(&Outputs::new().add("partial", partial), true)?;
        }
        sleep(Duration::from_secs_f64(inputs.delay));
    }
    let i: Vec<u32> = (0..inputs.steps).collect();
    Ok(Outputs::new().add("final", ModelOutput::new(i.len()).add_u32("i", i)))
}

fn boom(_ctx: &mut Context, _inputs: ()) -> Result<Outputs> {
    Err("kaboom".into())
}

fn prints(ctx: &mut Context, _inputs: ()) -> Result<Outputs> {
    println!("hello from stdout");
    ctx.log("from ctx");
    Ok(Outputs::new())
}

fn crash(_ctx: &mut Context, _inputs: ()) -> Result<Outputs> {
    std::process::exit(3)
}

fn main() {
    Tasks::new()
        .task("echo", echo)
        .doc("Return a small table of n rows.")
        .task("slow", slow)
        .task("boom", boom)
        .task("prints", prints)
        .task("crash", crash)
        .serve();
}

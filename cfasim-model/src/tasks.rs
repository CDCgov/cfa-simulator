//! Native task worker for `cfasim serve`.
//!
//! A tasks binary registers functions with [`Tasks`] and calls [`Tasks::serve`],
//! which speaks the worker protocol over stdin/stdout: the server sends one JSON
//! command per line (`run`, `shutdown`) and the worker answers with JSON events
//! (`worker_ready`, `progress`, `log`, `outputs`, `done`, `error`). Outputs
//! never cross the pipe: the worker writes `outputs.cfasim` into the run
//! directory itself and only announces a new revision.
//!
//! ```no_run
//! use cfasim_model::tasks::{Context, Tasks};
//! use cfasim_model::{ModelOutput, Outputs};
//! use serde::{Deserialize, Serialize};
//!
//! #[derive(Serialize, Deserialize)]
//! #[serde(default)]
//! struct Inputs { steps: u32, rate: f64 }
//!
//! impl Default for Inputs {
//!     fn default() -> Self { Self { steps: 10, rate: 2.5 } }
//! }
//!
//! fn simulate(ctx: &mut Context, inputs: Inputs) -> cfasim_model::tasks::Result<Outputs> {
//!     let values: Vec<f64> = (0..inputs.steps).map(|t| t as f64 * inputs.rate).collect();
//!     ctx.progress(1.0, "done");
//!     Ok(Outputs::new().add("series", ModelOutput::new(values.len()).add_f64("values", values)))
//! }
//!
//! fn main() {
//!     Tasks::new().task("simulate", simulate).doc("Run the model").serve();
//! }
//! ```
//!
//! Plain `println!` output is safe: the server treats any stdout line that is
//! not a protocol frame as a log line of the current run.

use std::io::{self, BufRead, Write};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::{Path, PathBuf};

/// Worker protocol version, `major.minor`. The server warns when the major
/// differs from its own; minor versions only add fields.
pub const PROTOCOL: &str = "1.0";

use serde::de::{DeserializeOwned, Deserializer, MapAccess, Visitor};
use serde::Serialize;
use serde_json::{json, Map, Value};

use crate::outputs_file::{write_csvs, write_outputs};
use crate::Outputs;

pub type Error = Box<dyn std::error::Error + Send + Sync>;
pub type Result<T> = std::result::Result<T, Error>;

pub const OUTPUTS_FILENAME: &str = "outputs.cfasim";

/// Progress, logging, and output hooks for a running task.
///
/// `run_dir` belongs to the task: write CSVs, figures, or reports there and the
/// server lists and serves them under `/api/runs/{id}/files`.
pub struct Context {
    run_id: String,
    run_dir: PathBuf,
    write_csv: bool,
    revision: u32,
}

impl Context {
    pub fn run_id(&self) -> &str {
        &self.run_id
    }

    pub fn run_dir(&self) -> &Path {
        &self.run_dir
    }

    /// How many times `emit` has written outputs so far.
    pub fn revision(&self) -> u32 {
        self.revision
    }

    /// Report progress in `[0, 1]`; an empty message means none.
    pub fn progress(&mut self, fraction: f64, message: &str) {
        let message = if message.is_empty() {
            Value::Null
        } else {
            Value::String(message.to_string())
        };
        self.send(
            "progress",
            json!({ "fraction": fraction.clamp(0.0, 1.0), "message": message }),
        );
    }

    /// Append a line to the run log.
    pub fn log(&mut self, line: &str) {
        self.send(
            "log",
            json!({ "stream": "task", "line": line, "overwrite": false }),
        );
    }

    /// Write `outputs.cfasim` now and tell the page a new revision exists.
    ///
    /// Call it repeatedly with `partial = true` to stream intermediate results;
    /// the worker emits a task's returned outputs as the final revision.
    pub fn emit(&mut self, outputs: &Outputs, partial: bool) -> io::Result<()> {
        write_outputs(&self.run_dir.join(OUTPUTS_FILENAME), outputs)?;
        if self.write_csv && !partial {
            write_csvs(&self.run_dir, outputs)?;
        }
        self.revision += 1;
        self.send(
            "outputs",
            json!({ "revision": self.revision, "partial": partial, "names": outputs.names() }),
        );
        Ok(())
    }

    fn send(&self, type_: &str, fields: Value) {
        post(type_, Some(&self.run_id), fields);
    }
}

/// Write one protocol frame. The leading newline ends any partial `print!`
/// output sharing stdout, so the frame always starts its own line.
fn post(type_: &str, run_id: Option<&str>, fields: Value) {
    let mut event = Map::new();
    event.insert("type".into(), type_.into());
    event.insert("run_id".into(), run_id.map_or(Value::Null, Into::into));
    if let Value::Object(extra) = fields {
        event.extend(extra);
    }
    let stdout = io::stdout();
    let mut out = stdout.lock();
    let _ = out.write_all(b"\n");
    let _ = serde_json::to_writer(&mut out, &Value::Object(event));
    let _ = out.write_all(b"\n");
    let _ = out.flush();
}

fn post_error(run_id: &str, message: String) {
    post(
        "error",
        Some(run_id),
        json!({ "message": message, "traceback": null }),
    );
}

#[derive(Serialize)]
struct ParamSpec {
    name: String,
    required: bool,
    default: Value,
    annotation: Option<String>,
}

fn json_type_name(value: &Value) -> Option<String> {
    let name = match value {
        Value::Null => return None,
        Value::Bool(_) => "bool",
        Value::Number(n) if n.is_i64() || n.is_u64() => "int",
        Value::Number(_) => "float",
        Value::String(_) => "str",
        Value::Array(_) => "list",
        Value::Object(_) => "dict",
    };
    Some(name.to_string())
}

type RunFn = Box<dyn Fn(&mut Context, Value) -> Result<Outputs>>;

/// The fields of a serialized struct in declaration order (a `serde_json::Map`
/// sorts them), or `None` when the value is not an object.
fn ordered_fields<T: Serialize>(value: &T) -> Option<Vec<(String, Value)>> {
    struct Fields;
    impl<'de> Visitor<'de> for Fields {
        type Value = Vec<(String, Value)>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("an object")
        }
        fn visit_map<A: MapAccess<'de>>(
            self,
            mut map: A,
        ) -> std::result::Result<Self::Value, A::Error> {
            let mut fields = Vec::new();
            while let Some(entry) = map.next_entry::<String, Value>()? {
                fields.push(entry);
            }
            Ok(fields)
        }
    }
    let text = serde_json::to_string(value).ok()?;
    let mut de = serde_json::Deserializer::from_str(&text);
    de.deserialize_map(Fields).ok()
}

struct TaskEntry {
    name: String,
    doc: Option<String>,
    params: Vec<ParamSpec>,
    run: RunFn,
}

impl TaskEntry {
    fn describe(&self) -> Value {
        json!({
            "name": self.name,
            "doc": self.doc,
            "params": self.params,
            "accepts_extra": false,
        })
    }
}

/// The registry of a tasks binary.
#[derive(Default)]
pub struct Tasks {
    tasks: Vec<TaskEntry>,
}

impl Tasks {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register `f` as the task `name`.
    ///
    /// Inputs arrive as JSON and are deserialized into `I`; its `Default`
    /// value describes the parameters (names and defaults) to the page, so
    /// derive `Serialize`, `Deserialize`, and `Default` with
    /// `#[serde(default)]`. A task with no inputs can take `()`.
    ///
    /// Every field must serialize: one skipped by `skip_serializing_if` is
    /// missing from the parameters, so the server rejects it as an unknown
    /// input.
    pub fn task<I, F>(mut self, name: &str, f: F) -> Self
    where
        I: DeserializeOwned + Serialize + Default,
        F: Fn(&mut Context, I) -> Result<Outputs> + 'static,
    {
        if self.tasks.iter().any(|t| t.name == name) {
            panic!("task {name:?} is already registered");
        }
        let default = I::default();
        let takes_object = match serde_json::to_value(&default) {
            Ok(Value::Object(_)) => true,
            Ok(Value::Null) => false,
            other => panic!(
                "task {name:?}: inputs must serialize to a JSON object (a struct with \
                 `#[serde(default)]`) or to null (`()`), not {other:?}"
            ),
        };
        let defaults = ordered_fields(&default);
        let params = defaults
            .unwrap_or_default()
            .into_iter()
            .map(|(name, default)| ParamSpec {
                annotation: json_type_name(&default),
                name,
                required: false,
                default,
            })
            .collect();
        let run: RunFn = Box::new(move |ctx, inputs| {
            let inputs = if takes_object { inputs } else { Value::Null };
            let inputs: I =
                serde_json::from_value(inputs).map_err(|e| format!("invalid inputs: {e}"))?;
            f(ctx, inputs)
        });
        self.tasks.push(TaskEntry {
            name: name.to_string(),
            doc: None,
            params,
            run,
        });
        self
    }

    /// Document the task registered last.
    pub fn doc(mut self, text: &str) -> Self {
        let last = self.tasks.last_mut().expect("doc() comes after task()");
        last.doc = Some(text.to_string());
        self
    }

    /// Serve commands from stdin until it closes or a `shutdown` arrives.
    pub fn serve(self) {
        self.serve_io(io::stdin().lock());
        std::process::exit(0);
    }

    fn serve_io(self, commands: impl BufRead) {
        post(
            "worker_ready",
            None,
            json!({
                "protocol": PROTOCOL,
                "pid": std::process::id(),
                "tasks": self.tasks.iter().map(TaskEntry::describe).collect::<Vec<_>>(),
                "files": [],
            }),
        );
        for line in commands.lines() {
            let Ok(line) = line else { break };
            if line.trim().is_empty() {
                continue;
            }
            let Ok(command) = serde_json::from_str::<Value>(&line) else {
                eprintln!("cfasim worker: ignoring malformed command {line:?}");
                continue;
            };
            match command["cmd"].as_str() {
                Some("shutdown") => return,
                Some("run") => self.run(&command),
                other => eprintln!("cfasim worker: unknown command {other:?}"),
            }
        }
    }

    fn run(&self, command: &Value) {
        let run_id = command["run_id"].as_str().unwrap_or("").to_string();
        let name = command["task"].as_str().unwrap_or("");
        let mut ctx = Context {
            run_id: run_id.clone(),
            run_dir: PathBuf::from(command["run_dir"].as_str().unwrap_or(".")),
            write_csv: command["csv"].as_bool().unwrap_or(false),
            revision: 0,
        };
        let inputs = command
            .get("inputs")
            .cloned()
            .unwrap_or(Value::Object(Map::new()));
        let Some(task) = self.tasks.iter().find(|t| t.name == name) else {
            post_error(&run_id, format!("unknown task {name:?}"));
            return;
        };
        let outcome = catch_unwind(AssertUnwindSafe(|| (task.run)(&mut ctx, inputs)));
        let result = match outcome {
            Ok(result) => result,
            Err(payload) => {
                let message = payload
                    .downcast_ref::<&str>()
                    .map(|s| s.to_string())
                    .or_else(|| payload.downcast_ref::<String>().cloned())
                    .unwrap_or_else(|| "task panicked".to_string());
                Err(format!("panic: {message}").into())
            }
        };
        match result {
            Ok(outputs) => {
                if !outputs.is_empty() {
                    if let Err(e) = ctx.emit(&outputs, false) {
                        post_error(&run_id, format!("writing outputs: {e}"));
                        return;
                    }
                }
                post("done", Some(&run_id), json!({}));
            }
            Err(e) => post_error(&run_id, e.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Serialize, Deserialize)]
    #[serde(default)]
    struct Inputs {
        steps: u32,
        label: String,
    }

    impl Default for Inputs {
        fn default() -> Self {
            Self {
                steps: 3,
                label: "x".into(),
            }
        }
    }

    #[test]
    fn describes_params_from_defaults() {
        let tasks = Tasks::new()
            .task("echo", |_ctx: &mut Context, _i: Inputs| Ok(Outputs::new()))
            .doc("Echo")
            .task("noop", |_ctx: &mut Context, _i: ()| Ok(Outputs::new()));
        let described: Vec<Value> = tasks.tasks.iter().map(TaskEntry::describe).collect();
        assert_eq!(
            described[0],
            json!({
                "name": "echo",
                "doc": "Echo",
                "params": [
                    { "name": "steps", "required": false, "default": 3, "annotation": "int" },
                    { "name": "label", "required": false, "default": "x", "annotation": "str" },
                ],
                "accepts_extra": false,
            })
        );
        assert_eq!(described[1]["params"], json!([]));
        assert_eq!(described[1]["name"], "noop");
    }

    #[test]
    #[should_panic(expected = "must serialize to a JSON object")]
    fn non_object_inputs_panic_at_registration() {
        #[derive(Serialize, Deserialize, Default)]
        struct Seed(u64);
        Tasks::new().task("seed", |_ctx: &mut Context, _i: Seed| Ok(Outputs::new()));
    }

    #[test]
    #[should_panic(expected = "doc() comes after task()")]
    fn doc_before_task_panics() {
        Tasks::new().doc("orphan");
    }

    #[test]
    fn unit_inputs_accept_an_object() {
        let tasks = Tasks::new().task("noop", |_ctx: &mut Context, _i: ()| Ok(Outputs::new()));
        let mut ctx = Context {
            run_id: "r".into(),
            run_dir: std::env::temp_dir(),
            write_csv: false,
            revision: 0,
        };
        assert!((tasks.tasks[0].run)(&mut ctx, json!({})).is_ok());
    }

    #[test]
    #[should_panic(expected = "already registered")]
    fn duplicate_names_panic() {
        Tasks::new()
            .task("a", |_ctx: &mut Context, _i: ()| Ok(Outputs::new()))
            .task("a", |_ctx: &mut Context, _i: ()| Ok(Outputs::new()));
    }
}

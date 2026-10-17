//! Job orchestration: the worker process, the queue, and per-run event buffers.

use std::collections::{BTreeMap, HashMap, VecDeque};
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard, Weak};
use std::time::{Duration, Instant, SystemTime};

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, BufReader};

use tokio::sync::{mpsc, Notify};

use super::config::WorkerSpec;
use super::events::{self, event_seq, event_str, event_type, make_event, Event};
use super::runs::{self, status_str, RunStore, Status};
use super::worker::{self, WorkerHandle};

const MAX_LOG_EVENTS: usize = 500;
/// Finished runs whose event history stays in memory for replay.
const MAX_BUFFERS: usize = 50;
const STATUS_WRITE_INTERVAL: Duration = Duration::from_secs(1);
pub const WORKER_READY_TIMEOUT: Duration = Duration::from_secs(60);
const RELOAD_POLL_INTERVAL: Duration = Duration::from_secs(1);
/// Exits in a row without running anything before the worker counts as broken.
const MAX_IDLE_EXITS: u32 = 3;
const WATCH_SKIP_DIRS: [&str; 6] = [
    "target",
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
];
const WATCH_EXTENSIONS: [&str; 3] = ["rs", "toml", "py"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkerState {
    Starting,
    Ready,
    /// The task module did not import or the binary did not build; no respawn
    /// until a watched file changes.
    Failed,
}

#[derive(Debug, Clone)]
pub struct ParamSpec {
    pub name: String,
    pub required: bool,
}

#[derive(Debug, Clone)]
pub struct TaskSpec {
    pub name: String,
    pub params: Vec<ParamSpec>,
    pub accepts_extra: bool,
    /// The worker's own description, served as-is by `/tasks`.
    pub describe: Value,
}

impl TaskSpec {
    fn from_value(value: &Value) -> Option<Self> {
        let name = value["name"].as_str()?.to_string();
        let params = value["params"]
            .as_array()
            .map(|ps| {
                ps.iter()
                    .filter_map(|p| {
                        Some(ParamSpec {
                            name: p["name"].as_str()?.to_string(),
                            required: p["required"].as_bool().unwrap_or(false),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();
        Some(Self {
            name,
            params,
            accepts_extra: value["accepts_extra"].as_bool().unwrap_or(false),
            describe: value.clone(),
        })
    }

    /// `Err(message)` when `inputs` do not fit the task signature.
    pub fn validate(&self, inputs: &Value) -> Result<(), String> {
        let Value::Object(map) = inputs else {
            return Err("inputs must be a JSON object".into());
        };
        let known: Vec<&str> = self.params.iter().map(|p| p.name.as_str()).collect();
        let mut unknown: Vec<&str> = map
            .keys()
            .map(String::as_str)
            .filter(|k| !known.contains(k))
            .collect();
        unknown.sort_unstable();
        if !unknown.is_empty() && !self.accepts_extra {
            let mut accepted = known.clone();
            accepted.sort_unstable();
            let accepted = if accepted.is_empty() {
                "no inputs".to_string()
            } else {
                accepted.join(", ")
            };
            return Err(format!(
                "unknown input(s) {}; task {:?} accepts {}",
                unknown.join(", "),
                self.name,
                accepted
            ));
        }
        let mut missing: Vec<&str> = self
            .params
            .iter()
            .filter(|p| p.required && !map.contains_key(&p.name))
            .map(|p| p.name.as_str())
            .collect();
        missing.sort_unstable();
        if !missing.is_empty() {
            return Err(format!("missing required input(s): {}", missing.join(", ")));
        }
        Ok(())
    }
}

/// A run's events kept for replay, plus its live subscribers.
///
/// Log lines are capped, only the latest `progress` and `outputs` are kept
/// (each supersedes the last), and progress-bar rewrites (`overwrite`) go to
/// live subscribers only; the rest is kept so a reconnecting page can catch up
/// from `Last-Event-ID`.
struct RunBuffer {
    seq: u64,
    events: Vec<Event>,
    logs: VecDeque<Event>,
    subscribers: Vec<mpsc::UnboundedSender<Option<Event>>>,
    closed: bool,
    /// The live status document; status.json is its persisted copy.
    status: Status,
    last_status_write: Option<Instant>,
    /// log.txt, opened on the first line and closed with the buffer.
    log: Option<File>,
}

fn is_overwrite(event: &Event) -> bool {
    event
        .get("overwrite")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

impl RunBuffer {
    fn new(status: Status) -> Self {
        Self {
            seq: 0,
            events: Vec::new(),
            logs: VecDeque::new(),
            subscribers: Vec::new(),
            closed: false,
            status,
            last_status_write: None,
            log: None,
        }
    }

    fn append(&mut self, mut event: Event) {
        self.seq += 1;
        event.insert("seq".into(), self.seq.into());
        let type_ = event_type(&event);
        if type_ != events::LOG {
            if matches!(type_, events::PROGRESS | events::OUTPUTS) {
                self.events.retain(|e| event_type(e) != type_);
            }
            self.events.push(event.clone());
        } else if !is_overwrite(&event) {
            if self.logs.len() == MAX_LOG_EVENTS {
                self.logs.pop_front();
            }
            self.logs.push_back(event.clone());
        }
        self.subscribers
            .retain(|tx| tx.send(Some(event.clone())).is_ok());
    }

    fn history(&self) -> Vec<Event> {
        let mut all: Vec<Event> = self
            .events
            .iter()
            .chain(self.logs.iter())
            .cloned()
            .collect();
        all.sort_by_key(event_seq);
        all
    }

    fn close(&mut self) {
        self.closed = true;
        self.log = None;
        for tx in self.subscribers.drain(..) {
            let _ = tx.send(None);
        }
    }
}

/// Fold one run event into its status document. Returns whether the document
/// should be written out right away (progress updates may be throttled).
fn apply_event(status: &mut Status, event: &Event) -> bool {
    let type_ = event_type(event);
    if type_ == events::PROGRESS {
        status.insert(
            "progress".into(),
            json!({ "fraction": event.get("fraction"), "message": event.get("message") }),
        );
        return false;
    }
    if type_ == events::OUTPUTS {
        status.insert(
            "outputs".into(),
            json!({
                "revision": event.get("revision"),
                "partial": event.get("partial").and_then(Value::as_bool).unwrap_or(false),
                "names": event.get("names").cloned().unwrap_or_else(|| json!([])),
            }),
        );
    } else if type_ == events::STATUS {
        let new_status = event_str(event, "status").unwrap_or("");
        status.insert("status".into(), new_status.into());
        if new_status == runs::RUNNING {
            status.insert(
                "started_at".into(),
                event.get("time").cloned().unwrap_or(Value::Null),
            );
        }
    } else if events::is_terminal(type_) {
        status.insert("status".into(), type_.into());
        status.insert(
            "finished_at".into(),
            event.get("time").cloned().unwrap_or(Value::Null),
        );
        if type_ == events::ERROR {
            status.insert(
                "error".into(),
                json!({ "message": event.get("message"), "traceback": event.get("traceback") }),
            );
        }
        if type_ == events::DONE {
            if let Some(Value::Object(progress)) = status.get_mut("progress") {
                progress.insert("fraction".into(), 1.0.into());
            }
        }
    }
    true
}

struct State {
    worker: Option<WorkerHandle>,
    generation: u64,
    worker_state: WorkerState,
    worker_error: Option<String>,
    protocol: Option<String>,
    tasks: BTreeMap<String, TaskSpec>,
    buffers: HashMap<String, RunBuffer>,
    buffer_order: Vec<String>,
    queue: VecDeque<String>,
    current: Option<String>,
    /// Source files the worker reported, plus the spec's watch roots, with
    /// their mtimes; a change restarts the worker after the current run.
    reported: Vec<PathBuf>,
    watched: HashMap<PathBuf, Option<SystemTime>>,
    reloads: u32,
    reload_pending: bool,
    reloading: bool,
    /// Set when we kill the worker on purpose while a run is going, so its
    /// exit marks that run cancelled rather than failed. Nothing new starts
    /// on the dying worker meanwhile.
    cancelling: bool,
    /// Whether the current worker process has been sent a run.
    ran_since_spawn: bool,
    /// Consecutive worker exits with no run sent.
    idle_exits: u32,
    stopping: bool,
}

impl State {
    fn ready(&self) -> bool {
        self.worker.is_some() && self.worker_state == WorkerState::Ready
    }

    fn alive(&self) -> bool {
        self.worker.as_ref().is_some_and(|w| !w.has_exited())
    }
}

pub enum CancelError {
    Unknown,
    /// The run already ended with this status.
    Finished(String),
}

pub struct Manager {
    pub store: RunStore,
    pub spec: WorkerSpec,
    pub write_csv: bool,
    state: Mutex<State>,
    settled: Notify,
    /// Lets synchronous paths (a run ending, a file change) spawn the async
    /// worker lifecycle tasks.
    me: Weak<Manager>,
}

impl Manager {
    pub fn new(store: RunStore, spec: WorkerSpec, write_csv: bool) -> Arc<Self> {
        Arc::new_cyclic(|me| Self {
            store,
            spec,
            write_csv,
            me: me.clone(),
            state: Mutex::new(State {
                worker: None,
                generation: 0,
                worker_state: WorkerState::Starting,
                worker_error: None,
                protocol: None,
                tasks: BTreeMap::new(),
                buffers: HashMap::new(),
                buffer_order: Vec::new(),
                queue: VecDeque::new(),
                current: None,
                reported: Vec::new(),
                watched: HashMap::new(),
                reloads: 0,
                reload_pending: false,
                reloading: false,
                cancelling: false,
                ran_since_spawn: false,
                idle_exits: 0,
                stopping: false,
            }),
            settled: Notify::new(),
        })
    }

    fn lock(&self) -> MutexGuard<'_, State> {
        self.state.lock().unwrap_or_else(|e| e.into_inner())
    }

    // -- lifecycle ---------------------------------------------------------

    pub fn start(self: &Arc<Self>) {
        self.store.mark_stale();
        // Watch the spec's roots before the first worker reports, so a project
        // that fails to build or import still reloads once it is fixed.
        self.lock().watched = self.snapshot(&[]);
        tokio::spawn(self.clone().spawn_worker());
        tokio::spawn(self.clone().watch_sources());
    }

    pub async fn stop(self: &Arc<Self>) {
        let (handle, busy) = {
            let mut st = self.lock();
            st.stopping = true;
            for buf in st.buffers.values_mut() {
                if !buf.closed {
                    buf.close();
                }
            }
            (st.worker.take(), st.current.is_some())
        };
        if let Some(handle) = handle {
            if busy {
                handle.kill();
            } else {
                handle.retire().await;
            }
        }
    }

    /// Wait until the worker is ready or has failed; returns readiness.
    pub async fn wait_ready(&self, timeout: Duration) -> bool {
        let deadline = Instant::now() + timeout;
        loop {
            let notified = self.settled.notified();
            tokio::pin!(notified);
            notified.as_mut().enable();
            {
                let st = self.lock();
                if st.ready() || st.worker_state == WorkerState::Failed {
                    return st.ready();
                }
            }
            let now = Instant::now();
            if now >= deadline
                || tokio::time::timeout(deadline - now, notified)
                    .await
                    .is_err()
            {
                return self.lock().ready();
            }
        }
    }

    async fn spawn_worker(self: Arc<Self>) {
        let prepared = self.spec.prepare().await;
        let mut st = self.lock();
        if st.stopping {
            return;
        }
        match prepared {
            Ok(command) => self.spawn_child(&mut st, command),
            Err(e) => self.fail_worker(&mut st, format!("{e:#}")),
        }
    }

    fn fail_worker(&self, st: &mut State, message: String) {
        eprintln!("cfasim serve: {message}");
        st.worker_state = WorkerState::Failed;
        st.worker_error = Some(message);
        self.fail_queued(st);
        self.settled.notify_waiters();
    }

    fn spawn_child(&self, st: &mut State, command: Vec<String>) {
        st.generation += 1;
        let generation = st.generation;
        match worker::spawn(&command, &self.spec.cwd) {
            Ok(spawned) => {
                st.worker = Some(spawned.handle);
                st.cancelling = false;
                st.ran_since_spawn = false;
                st.worker_state = WorkerState::Starting;
                st.worker_error = None;
                if let Some(me) = self.me.upgrade() {
                    tokio::spawn(me.clone().read_events(
                        generation,
                        spawned.child,
                        spawned.stdout,
                        spawned.exited,
                    ));
                    tokio::spawn(me.ready_timeout(generation));
                }
            }
            Err(e) => {
                let hint = self.spec.spawn_hint;
                self.fail_worker(
                    st,
                    format!("failed to start worker `{}`: {e}{hint}", command.join(" ")),
                );
            }
        }
    }

    /// A worker that never reports ready (a hung import, a program that is not
    /// a worker at all) is killed and the project marked failed.
    async fn ready_timeout(self: Arc<Self>, generation: u64) {
        tokio::time::sleep(WORKER_READY_TIMEOUT).await;
        let mut st = self.lock();
        if generation != st.generation || st.worker_state != WorkerState::Starting {
            return;
        }
        self.fail_worker(
            &mut st,
            format!(
                "worker did not report ready within {} s",
                WORKER_READY_TIMEOUT.as_secs()
            ),
        );
        if let Some(w) = &st.worker {
            w.kill();
        }
    }

    async fn read_events(
        self: Arc<Self>,
        generation: u64,
        mut child: tokio::process::Child,
        stdout: tokio::process::ChildStdout,
        exited: tokio::sync::watch::Sender<bool>,
    ) {
        // Bytes, not `lines()`: one invalid UTF-8 line must not end the stream.
        let mut reader = BufReader::new(stdout);
        let mut buf = Vec::new();
        loop {
            buf.clear();
            match reader.read_until(b'\n', &mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    let line = String::from_utf8_lossy(&buf)
                        .trim_end_matches(['\n', '\r'])
                        .to_string();
                    self.on_line(generation, line);
                }
            }
        }
        let code = child.wait().await.ok().and_then(|s| s.code());
        let _ = exited.send(true);
        self.on_worker_exited(generation, code);
    }

    // -- public API --------------------------------------------------------

    pub fn health(&self) -> Value {
        let st = self.lock();
        json!({
            "worker": {
                "pid": st.worker.as_ref().map(|w| w.pid),
                "alive": st.alive(),
                "ready": st.ready(),
                "busy": st.current.is_some(),
                "error": st.worker_error,
                "protocol": st.protocol,
                "reloads": st.reloads,
                "reload_pending": st.reload_pending,
                "watching": st.watched.len(),
            },
            "queued": st.queue.len(),
            "current": st.current,
        })
    }

    pub fn ready(&self) -> bool {
        self.lock().ready()
    }

    pub fn worker_error(&self) -> Option<String> {
        self.lock().worker_error.clone()
    }

    pub fn tasks(&self) -> Vec<Value> {
        self.lock()
            .tasks
            .values()
            .map(|t| t.describe.clone())
            .collect()
    }

    pub fn task(&self, name: &str) -> Option<TaskSpec> {
        self.lock().tasks.get(name).cloned()
    }

    pub fn submit(
        &self,
        task: &TaskSpec,
        inputs: &Value,
        name: Option<&str>,
    ) -> std::io::Result<Status> {
        let mut st = self.lock();
        let status = self
            .store
            .create(&task.name, inputs, name, &|id| st.buffers.contains_key(id))?;
        let run_id = status_str(&status, "run_id").to_string();
        st.buffers
            .insert(run_id.clone(), RunBuffer::new(status.clone()));
        st.buffer_order.push(run_id.clone());
        st.queue.push_back(run_id);
        self.pump(&mut st);
        Ok(status)
    }

    pub fn cancel(&self, run_id: &str) -> Result<(), CancelError> {
        let mut st = self.lock();
        let status = self.store.read_status(run_id).ok_or(CancelError::Unknown)?;
        let state = status_str(&status, "status");
        if events::is_terminal(state) {
            return Err(CancelError::Finished(state.to_string()));
        }
        if st.current.as_deref() == Some(run_id) {
            // The worker's exit comes back through the reader and finishes
            // the run as cancelled.
            st.cancelling = true;
            if let Some(w) = &st.worker {
                w.kill();
            }
            return Ok(());
        }
        if let Some(pos) = st.queue.iter().position(|id| id == run_id) {
            st.queue.remove(pos);
            self.on_run_event(
                &mut st,
                run_id,
                make_event(events::CANCELLED, Some(run_id), json!({})),
            );
            return Ok(());
        }
        Err(CancelError::Unknown)
    }

    /// History so far plus a live receiver (`None` when the run is over).
    ///
    /// A run from a previous server session has no buffer; its status
    /// document already tells a client everything, so the stream is empty.
    pub fn subscribe(
        &self,
        run_id: &str,
    ) -> (Vec<Event>, Option<mpsc::UnboundedReceiver<Option<Event>>>) {
        let mut st = self.lock();
        let Some(buf) = st.buffers.get_mut(run_id) else {
            return (Vec::new(), None);
        };
        if buf.closed {
            return (buf.history(), None);
        }
        let (tx, rx) = mpsc::unbounded_channel();
        buf.subscribers.push(tx);
        (buf.history(), Some(rx))
    }

    // -- event handling ----------------------------------------------------

    fn on_line(&self, generation: u64, line: String) {
        if line.trim().is_empty() {
            return;
        }
        if line.starts_with('{') {
            if let Ok(Value::Object(event)) = serde_json::from_str::<Value>(&line) {
                if event.contains_key("type") {
                    self.on_event(generation, event);
                    return;
                }
            }
        }
        // Anything else on stdout is the task printing: log it to the run.
        let mut st = self.lock();
        if generation != st.generation {
            return;
        }
        match st.current.clone() {
            Some(run_id) => self.on_run_event(
                &mut st,
                &run_id,
                make_event(
                    events::LOG,
                    Some(&run_id),
                    json!({ "stream": "stdout", "line": line, "overwrite": false }),
                ),
            ),
            None => eprintln!("[worker] {line}"),
        }
    }

    fn on_event(&self, generation: u64, mut event: Event) {
        let mut st = self.lock();
        if generation != st.generation {
            return; // a stale reader from a killed worker
        }
        if !event.contains_key("time") {
            event.insert("time".into(), events::now_iso().into());
        }
        match event_type(&event) {
            events::WORKER_READY => {
                st.worker_state = WorkerState::Ready;
                st.protocol = event_str(&event, "protocol").map(str::to_string);
                if let Some(warning) = events::protocol_warning(st.protocol.as_deref()) {
                    eprintln!("cfasim serve: {warning}");
                }
                st.tasks = event
                    .get("tasks")
                    .and_then(Value::as_array)
                    .map(|ts| {
                        ts.iter()
                            .filter_map(TaskSpec::from_value)
                            .map(|t| (t.name.clone(), t))
                            .collect()
                    })
                    .unwrap_or_default();
                st.reported = event
                    .get("files")
                    .and_then(Value::as_array)
                    .map(|fs| {
                        fs.iter()
                            .filter_map(Value::as_str)
                            .map(PathBuf::from)
                            .collect()
                    })
                    .unwrap_or_default();
                st.watched = self.snapshot(&st.reported);
                self.settled.notify_waiters();
                self.pump(&mut st);
            }
            events::WORKER_EXITED => {
                // The task module failed to import; the process exit follows.
                if let Some(message) = event_str(&event, "message") {
                    st.worker_state = WorkerState::Failed;
                    st.worker_error = Some(message.to_string());
                    self.settled.notify_waiters();
                }
            }
            _ => {
                if let Some(run_id) = event_str(&event, "run_id").map(str::to_string) {
                    self.on_run_event(&mut st, &run_id, event);
                }
            }
        }
    }

    fn on_worker_exited(&self, generation: u64, code: Option<i32>) {
        let mut st = self.lock();
        if generation != st.generation || st.worker.is_none() {
            return; // retired or replaced already
        }
        st.worker = None;
        let cancelled = std::mem::take(&mut st.cancelling);
        let ran = std::mem::take(&mut st.ran_since_spawn);
        let never_ready = st.worker_state == WorkerState::Starting;
        if st.worker_state != WorkerState::Failed {
            st.worker_state = WorkerState::Starting;
        }
        if let Some(run_id) = st.current.take() {
            let ended = if cancelled {
                make_event(events::CANCELLED, Some(&run_id), json!({}))
            } else {
                let message = match code {
                    Some(code) => format!("worker exited with code {code}"),
                    None => "worker was killed".to_string(),
                };
                make_event(
                    events::ERROR,
                    Some(&run_id),
                    json!({ "message": message, "traceback": null }),
                )
            };
            self.on_run_event(&mut st, &run_id, ended);
        }
        if st.stopping {
            return;
        }
        if never_ready && !cancelled {
            // It never reported ready: respawning would only loop.
            let message = match code {
                Some(code) => format!("worker exited with code {code} before it was ready"),
                None => "worker was killed before it was ready".to_string(),
            };
            self.fail_worker(&mut st, message);
            return;
        }
        st.idle_exits = if ran || cancelled {
            0
        } else {
            st.idle_exits + 1
        };
        if st.idle_exits >= MAX_IDLE_EXITS {
            // Ready, then gone before any run: respawning would only loop.
            let message = format!(
                "worker exited {} times in a row without running anything",
                st.idle_exits
            );
            self.fail_worker(&mut st, message);
            return;
        }
        if st.worker_state == WorkerState::Failed {
            // Respawning would fail the same way; fail what is queued instead.
            self.fail_queued(&mut st);
            self.settled.notify_waiters();
            return;
        }
        if let Some(me) = self.me.upgrade() {
            tokio::spawn(me.spawn_worker());
        }
    }

    fn fail_queued(&self, st: &mut State) {
        let message = st
            .worker_error
            .clone()
            .unwrap_or_else(|| "the worker is not available".into());
        while let Some(run_id) = st.queue.pop_front() {
            self.on_run_event(
                st,
                &run_id,
                make_event(
                    events::ERROR,
                    Some(&run_id),
                    json!({ "message": message, "traceback": null }),
                ),
            );
        }
    }

    fn on_run_event(&self, st: &mut State, run_id: &str, event: Event) {
        let type_ = event_type(&event).to_string();
        let terminal = events::is_terminal(&type_);
        // Worker events only ever concern runs this server created.
        let Some(buf) = st.buffers.get_mut(run_id) else {
            return;
        };
        if buf.closed {
            // A late terminal event for the current run must still free the worker.
            if terminal && st.current.as_deref() == Some(run_id) {
                st.current = None;
                self.next(st);
            }
            return;
        }
        let store = &self.store;
        // A failed write is the cue to check whether the run dir was deleted.
        if type_ == events::LOG {
            if !is_overwrite(&event) {
                let stream = event_str(&event, "stream").unwrap_or("");
                let prefix = if stream == "stdout" {
                    String::new()
                } else {
                    format!("[{stream}] ")
                };
                let line = event_str(&event, "line").unwrap_or("");
                if buf.log.is_none() {
                    buf.log = store.open_log(run_id);
                }
                let written = buf
                    .log
                    .as_mut()
                    .is_some_and(|f| writeln!(f, "{prefix}{line}").is_ok());
                if !written && !store.exists(run_id) {
                    self.abandon(st, run_id, event);
                    return;
                }
            }
            buf.append(event);
            return;
        }
        let now = Instant::now();
        let due = match buf.last_status_write {
            Some(t) => now.duration_since(t) >= STATUS_WRITE_INTERVAL,
            None => true,
        };
        if apply_event(&mut buf.status, &event) || due {
            buf.last_status_write = Some(now);
            if !store.write_status(run_id, &buf.status) && !store.exists(run_id) {
                self.abandon(st, run_id, event);
                return;
            }
        }
        buf.append(event);
        if terminal {
            buf.close();
            self.evict_buffers(st);
            if st.current.as_deref() == Some(run_id) {
                st.current = None;
            }
            self.next(st);
        }
    }

    /// Keep only the newest closed buffers; status documents are the record.
    fn evict_buffers(&self, st: &mut State) {
        let closed: Vec<String> = st
            .buffer_order
            .iter()
            .filter(|id| st.buffers.get(*id).is_some_and(|b| b.closed))
            .cloned()
            .collect();
        let excess = closed.len().saturating_sub(MAX_BUFFERS);
        for run_id in &closed[..excess] {
            st.buffers.remove(run_id);
            st.buffer_order.retain(|id| id != run_id);
        }
    }

    /// The run's directory was deleted out from under it: drop it and move on.
    fn abandon(&self, st: &mut State, run_id: &str, event: Event) {
        let type_ = event_type(&event).to_string();
        if let Some(buf) = st.buffers.get_mut(run_id) {
            buf.append(event);
            buf.close();
        }
        if st.current.as_deref() != Some(run_id) {
            return;
        }
        st.current = None;
        if events::is_terminal(&type_) || st.cancelling {
            self.next(st);
            return;
        }
        // Still computing for nobody; stop it. The worker respawns on exit.
        eprintln!("cfasim serve: run {run_id} directory was deleted; cancelling");
        st.cancelling = true;
        if let Some(w) = &st.worker {
            w.kill();
        }
    }

    /// After a run ends: honor a pending reload, else start the next run.
    fn next(&self, st: &mut State) {
        if st.reload_pending {
            st.reload_pending = false;
            self.request_reload(st);
        } else {
            self.pump(st);
        }
    }

    fn pump(&self, st: &mut State) {
        // Nothing starts on a worker that is about to be retired or killed.
        if st.current.is_some()
            || st.queue.is_empty()
            || !st.ready()
            || st.reloading
            || st.cancelling
        {
            return;
        }
        let Some(run_id) = st.queue.pop_front() else {
            return;
        };
        let Some(status) = self.store.read_status(&run_id) else {
            if let Some(buf) = st.buffers.get_mut(&run_id) {
                buf.close(); // deleted while queued
            }
            self.pump(st);
            return;
        };
        let task = status_str(&status, "task").to_string();
        st.current = Some(run_id.clone());
        st.ran_since_spawn = true;
        self.on_run_event(
            st,
            &run_id,
            make_event(
                events::STATUS,
                Some(&run_id),
                json!({ "status": runs::RUNNING }),
            ),
        );
        let command = json!({
            "cmd": "run",
            "run_id": run_id,
            "task": task,
            "inputs": self.store.read_inputs(&run_id).unwrap_or_else(|| json!({})),
            "run_dir": self.store.run_dir(&run_id).map(|d| d.to_string_lossy().into_owned()),
            "csv": self.write_csv,
        });
        if let Some(w) = &st.worker {
            w.send(command);
        }
    }

    // -- reload ------------------------------------------------------------

    fn snapshot(&self, reported: &[PathBuf]) -> HashMap<PathBuf, Option<SystemTime>> {
        let mut files: Vec<PathBuf> = reported.to_vec();
        for root in &self.spec.watch {
            if root.is_dir() {
                let mut found = Vec::new();
                runs::walk_files(root, &|name| !WATCH_SKIP_DIRS.contains(&name), &mut found);
                files.extend(found.into_iter().filter(|p| {
                    p.extension()
                        .and_then(|e| e.to_str())
                        .is_some_and(|e| WATCH_EXTENSIONS.contains(&e))
                }));
            } else {
                files.push(root.clone());
            }
        }
        files.into_iter().map(|p| (p.clone(), mtime(&p))).collect()
    }

    async fn watch_sources(self: Arc<Self>) {
        loop {
            tokio::time::sleep(RELOAD_POLL_INTERVAL).await;
            let mut st = self.lock();
            if st.stopping {
                return;
            }
            if st.watched.is_empty() {
                continue;
            }
            let current = self.snapshot(&st.reported);
            let mut changed: Vec<&Path> = current
                .iter()
                .filter(|(path, mtime)| st.watched.get(*path) != Some(mtime))
                .map(|(path, _)| path.as_path())
                .collect();
            changed.extend(
                st.watched
                    .keys()
                    .filter(|p| !current.contains_key(*p))
                    .map(PathBuf::as_path),
            );
            if changed.is_empty() {
                continue;
            }
            let names: Vec<String> = changed
                .iter()
                .take(3)
                .map(|p| {
                    p.file_name()
                        .map(|n| n.to_string_lossy().into_owned())
                        .unwrap_or_default()
                })
                .collect();
            let names = names.join(", ");
            st.watched = current;
            if st.current.is_none() && !st.reloading {
                eprintln!("cfasim serve: {names} changed; restarting the worker");
                self.request_reload(&mut st);
            } else if !st.reload_pending {
                eprintln!(
                    "cfasim serve: {names} changed; restarting the worker after the current run"
                );
                st.reload_pending = true;
            }
        }
    }

    fn request_reload(&self, st: &mut State) {
        if st.reloading || st.stopping {
            st.reload_pending = true;
            return;
        }
        st.reloading = true;
        if let Some(me) = self.me.upgrade() {
            tokio::spawn(me.reload_worker());
        }
    }

    /// Build (for a Rust project) before touching the running worker, so a
    /// broken edit keeps the last good worker; then retire it and start the
    /// replacement.
    async fn reload_worker(self: Arc<Self>) {
        let command = match self.spec.prepare().await {
            Ok(command) => command,
            Err(e) => {
                let mut st = self.lock();
                st.reloading = false;
                if st.worker.is_some() {
                    eprintln!("cfasim serve: {e:#}; keeping the current worker");
                    self.pump(&mut st);
                } else {
                    self.fail_worker(&mut st, format!("{e:#}"));
                }
                return;
            }
        };
        let old = {
            let mut st = self.lock();
            st.reloading = false;
            if st.stopping {
                return;
            }
            debug_assert!(st.current.is_none(), "pump starts nothing while reloading");
            st.reloads += 1;
            st.idle_exits = 0;
            st.tasks.clear();
            st.worker.take()
        };
        if let Some(old) = old {
            old.retire().await;
        }
        let mut st = self.lock();
        if st.stopping {
            return;
        }
        self.spawn_child(&mut st, command);
        if st.reload_pending && st.current.is_none() {
            st.reload_pending = false;
            self.request_reload(&mut st);
        }
    }
}

fn mtime(path: &Path) -> Option<SystemTime> {
    std::fs::metadata(path).ok()?.modified().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(type_: &str, fields: Value) -> Event {
        make_event(type_, Some("r"), fields)
    }

    #[test]
    fn history_keeps_only_the_latest_progress_and_outputs() {
        let mut buf = RunBuffer::new(Status::new());
        buf.append(event(events::STATUS, json!({ "status": "running" })));
        for i in 0..1000 {
            buf.append(event(
                events::PROGRESS,
                json!({ "fraction": i as f64 / 1000.0 }),
            ));
            if i % 100 == 0 {
                buf.append(event(events::OUTPUTS, json!({ "revision": i / 100 })));
            }
        }
        buf.append(event(
            events::LOG,
            json!({ "line": "x", "overwrite": false }),
        ));
        buf.append(event(
            events::LOG,
            json!({ "line": "y", "overwrite": true }),
        ));
        buf.append(event(events::DONE, json!({})));

        let history = buf.history();
        let types: Vec<&str> = history.iter().map(event_type).collect();
        assert_eq!(types, ["status", "outputs", "progress", "log", "done"]);
        assert_eq!(history[1]["revision"], 9);
        assert_eq!(history[2]["fraction"], 0.999);
        let seqs: Vec<u64> = history.iter().map(event_seq).collect();
        assert!(seqs.windows(2).all(|w| w[0] < w[1]), "{seqs:?}");
        assert_eq!(*seqs.last().unwrap(), buf.seq);
    }
}

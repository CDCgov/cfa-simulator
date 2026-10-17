//! `cfasim serve` end to end: the real binary, a Rust tasks worker (the
//! `demo_tasks` example of cfasim-model), and the HTTP + SSE protocol.

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde_json::{json, Value};

const CLI: &str = env!("CARGO_BIN_EXE_cfasim");

/// Build the example worker once; `cargo build` is incremental afterwards.
fn demo_worker() -> PathBuf {
    static EXE: OnceLock<PathBuf> = OnceLock::new();
    EXE.get_or_init(|| {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let output = Command::new(env!("CARGO"))
            .args([
                "build",
                "-p",
                "cfasim-model",
                "--features",
                "tasks",
                "--example",
                "demo_tasks",
                "--message-format=json-render-diagnostics",
            ])
            .current_dir(&root)
            .stderr(Stdio::inherit())
            .output()
            .expect("cargo");
        assert!(output.status.success(), "building demo_tasks failed");
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|l| serde_json::from_str::<Value>(l).ok())
            .filter(|m| m["reason"] == "compiler-artifact")
            .find_map(|m| m["executable"].as_str().map(PathBuf::from))
            .expect("demo_tasks executable")
    })
    .clone()
}

/// The Python worker from `cfasim-model-py`, when uv is available.
fn python_worker() -> Option<String> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../cfasim-model-py");
    let ok = Command::new("uv")
        .args(["sync", "--project"])
        .arg(&root)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if !ok {
        eprintln!("uv is not available; skipping the Python worker check");
        return None;
    }
    Some(format!(
        "uv run --project {} python -m cfasim_model.server.worker {}",
        root.display(),
        root.join("tests/demo_tasks.py").display()
    ))
}

struct Server {
    child: Child,
    url: String,
    agent: ureq::Agent,
    stderr: Arc<Mutex<Vec<String>>>,
    _dir: tempfile::TempDir,
}

impl Server {
    fn start() -> Self {
        Self::start_with(&[])
    }

    fn start_with(extra: &[&str]) -> Self {
        Self::start_worker(&demo_worker().to_string_lossy(), extra)
    }

    fn start_worker(worker: &str, extra: &[&str]) -> Self {
        let dir = tempfile::TempDir::new().unwrap();
        let mut child = Command::new(CLI)
            .arg("serve")
            .args(["--port", "0", "--output"])
            .arg(dir.path().join("output"))
            .arg("--worker")
            .arg(worker)
            .args(extra)
            .current_dir(dir.path())
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .expect("spawn cfasim serve");
        let stderr = child.stderr.take().unwrap();
        let lines = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&lines);
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                eprintln!("[serve] {line}");
                if let Some(url) = line.strip_prefix("cfasim serve: API at ") {
                    let _ = tx.send(url.trim_end_matches("/api").to_string());
                }
                sink.lock().unwrap().push(line);
            }
        });
        let url = rx
            .recv_timeout(Duration::from_secs(30))
            .expect("server did not announce its port");
        let agent = ureq::Agent::new_with_config(
            ureq::Agent::config_builder()
                .http_status_as_error(false)
                .timeout_global(None)
                .build(),
        );
        Self {
            child,
            url,
            agent,
            stderr: lines,
            _dir: dir,
        }
    }

    fn stderr_lines(&self) -> Vec<String> {
        self.stderr.lock().unwrap().clone()
    }

    /// The body as JSON, or as a JSON string when it is not JSON.
    fn json(text: String) -> Value {
        serde_json::from_str(&text).unwrap_or(Value::String(text))
    }

    fn get(&self, path: &str) -> (u16, Value) {
        let (status, text) = self.get_text(path);
        (status, Self::json(text))
    }

    fn get_text(&self, path: &str) -> (u16, String) {
        let mut res = self
            .agent
            .get(format!("{}/api{path}", self.url))
            .call()
            .unwrap();
        (
            res.status().as_u16(),
            res.body_mut().read_to_string().unwrap(),
        )
    }

    fn post(&self, path: &str, body: Value) -> (u16, Value) {
        let mut res = self
            .agent
            .post(format!("{}/api{path}", self.url))
            .header("Content-Type", "application/json")
            .send(body.to_string().as_bytes())
            .unwrap();
        let status = res.status().as_u16();
        (status, Self::json(res.body_mut().read_to_string().unwrap()))
    }

    fn start_run(&self, task: &str, inputs: Value) -> String {
        let (status, body) = self.post(&format!("/tasks/{task}/run"), json!({ "inputs": inputs }));
        assert_eq!(status, 202, "{body}");
        body["run_id"].as_str().unwrap().to_string()
    }

    /// Read the run's event stream until the server closes it.
    fn events(&self, run_id: &str, after: Option<u64>) -> Vec<Value> {
        let mut req = self
            .agent
            .get(format!("{}/api/runs/{run_id}/events", self.url));
        if let Some(after) = after {
            req = req.header("Last-Event-ID", after.to_string());
        }
        let res = req.call().unwrap();
        assert_eq!(res.status().as_u16(), 200);
        let reader = BufReader::new(res.into_body().into_reader());
        reader
            .lines()
            .map_while(Result::ok)
            .filter_map(|line| line.strip_prefix("data: ").map(str::to_string))
            .map(|data| serde_json::from_str(&data).unwrap())
            .collect()
    }

    fn wait_status(&self, run_id: &str, states: &[&str]) -> Value {
        let deadline = Instant::now() + Duration::from_secs(30);
        loop {
            let (_, status) = self.get(&format!("/runs/{run_id}"));
            if states.contains(&status["status"].as_str().unwrap_or("")) {
                return status;
            }
            assert!(Instant::now() < deadline, "run {run_id} stuck in {status}");
            std::thread::sleep(Duration::from_millis(50));
        }
    }

    fn worker_pid(&self) -> u64 {
        self.get("/health").1["worker"]["pid"].as_u64().unwrap()
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn types(events: &[Value]) -> Vec<&str> {
    events.iter().map(|e| e["type"].as_str().unwrap()).collect()
}

fn pid_alive(pid: u64) -> bool {
    #[cfg(unix)]
    {
        Command::new("kill")
            .args(["-0", &pid.to_string()])
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        let _ = pid;
        false
    }
}

#[test]
fn health_and_tasks() {
    let server = Server::start();
    let (status, tasks) = server.get("/tasks");
    assert_eq!(status, 200);
    assert_eq!(tasks["ready"], true);
    let names: Vec<&str> = tasks["tasks"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t["name"].as_str().unwrap())
        .collect();
    assert_eq!(names, ["boom", "crash", "echo", "prints", "slow"]);
    let echo = &tasks["tasks"][2];
    assert_eq!(echo["doc"], "Return a small table of n rows.");
    assert_eq!(echo["params"][0]["name"], "n");
    assert_eq!(echo["params"][0]["default"], 3);
    assert_eq!(echo["params"][1]["annotation"], "str");

    let (_, health) = server.get("/health");
    assert_eq!(health["ok"], true);
    assert_eq!(health["worker"]["ready"], true);
    assert_eq!(health["worker"]["busy"], false);
    assert_eq!(health["worker"]["protocol"], "1.0");
    assert_eq!(health["queued"], 0);
}

#[test]
fn echo_run_streams_events_and_serves_outputs() {
    let server = Server::start();
    let (status, body) = server.post(
        "/tasks/echo/run",
        json!({ "inputs": { "n": 4, "label": "note" }, "name": "My Run" }),
    );
    assert_eq!(status, 202, "{body}");
    let run_id = body["run_id"].as_str().unwrap().to_string();
    assert!(run_id.starts_with("My-Run-"), "{run_id}");
    assert_eq!(body["name"], "My Run");
    assert_eq!(body["inputs_hash"].as_str().unwrap().len(), 16);

    let events = server.events(&run_id, None);
    assert_eq!(types(&events), ["status", "progress", "outputs", "done"]);
    let seqs: Vec<u64> = events.iter().map(|e| e["seq"].as_u64().unwrap()).collect();
    assert_eq!(seqs, [1, 2, 3, 4]);
    assert_eq!(events[1]["message"], "halfway");
    assert_eq!(events[2]["names"], json!(["series"]));
    assert_eq!(events[2]["partial"], false);
    let time = events[3]["time"].as_str().unwrap();
    assert!(
        time.len() >= 29 && time[time.len() - 6..].contains(':'),
        "{time}"
    );

    // Replay after the stream closed, and resumed from an id.
    assert_eq!(types(&server.events(&run_id, None)).len(), 4);
    assert_eq!(types(&server.events(&run_id, Some(2))), ["outputs", "done"]);

    let final_status = server.wait_status(&run_id, &["done"]);
    assert_eq!(final_status["progress"]["fraction"], 1.0);
    assert_eq!(
        final_status["outputs"],
        json!({ "revision": 1, "partial": false, "names": ["series"] })
    );
    assert!(final_status["started_at"].is_string());
    assert!(final_status["finished_at"].is_string());

    let mut res = server
        .agent
        .get(format!("{}/api/runs/{run_id}/outputs", server.url))
        .call()
        .unwrap();
    assert_eq!(res.headers()["content-type"], "application/octet-stream");
    let bytes = res.body_mut().read_to_vec().unwrap();
    let header_len = u32::from_le_bytes(bytes[..4].try_into().unwrap()) as usize;
    let header: Value = serde_json::from_slice(&bytes[4..4 + header_len]).unwrap();
    assert_eq!(header["outputs"]["series"]["length"], 4);

    let (_, inputs) = server.get(&format!("/runs/{run_id}/inputs"));
    assert_eq!(inputs, json!({ "n": 4, "label": "note" }));
    let (_, files) = server.get(&format!("/runs/{run_id}/files"));
    assert_eq!(files["files"][0]["path"], "note.txt");
    let (status, text) = server.get_text(&format!("/runs/{run_id}/files/note.txt"));
    assert_eq!((status, text.as_str()), (200, "custom output\n"));
    assert_eq!(
        server
            .get(&format!("/runs/{run_id}/files/../inputs.json"))
            .0,
        404
    );
    let (_, runs) = server.get("/runs");
    assert_eq!(runs["runs"][0]["run_id"], run_id);
    assert_eq!(server.get("/runs?task=other").1["runs"], json!([]));
}

#[test]
fn errors_prints_and_crashes() {
    let server = Server::start();
    let boom = server.start_run("boom", json!({}));
    let events = server.events(&boom, None);
    assert_eq!(types(&events), ["status", "error"]);
    assert_eq!(events[1]["message"], "kaboom");
    assert_eq!(
        server.wait_status(&boom, &["error"])["error"]["message"],
        "kaboom"
    );

    let prints = server.start_run("prints", json!({}));
    let events = server.events(&prints, None);
    assert_eq!(types(&events), ["status", "log", "log", "done"]);
    assert_eq!(events[1]["stream"], "stdout");
    assert_eq!(events[1]["line"], "hello from stdout");
    assert_eq!(events[2]["stream"], "task");
    let (_, log) = server.get_text(&format!("/runs/{prints}/log"));
    assert_eq!(log, "hello from stdout\n[task] from ctx\n");
    let (_, tail) = server.get_text(&format!("/runs/{prints}/log?tail=1"));
    assert_eq!(tail, "[task] from ctx\n");

    let pid = server.worker_pid();
    let crash = server.start_run("crash", json!({}));
    let status = server.wait_status(&crash, &["error"]);
    assert!(
        status["error"]["message"]
            .as_str()
            .unwrap()
            .contains("exited with code 3"),
        "{status}"
    );
    let again = server.start_run("echo", json!({}));
    assert_eq!(
        server.wait_status(&again, &["done", "error"])["status"],
        "done"
    );
    assert_ne!(server.worker_pid(), pid);
}

#[test]
fn cancel_kills_the_worker_and_continues_the_queue() {
    let server = Server::start();
    let pid = server.worker_pid();
    let slow = server.start_run("slow", json!({ "steps": 100, "delay": 0.1 }));
    let queued = server.start_run("echo", json!({}));
    server.wait_status(&slow, &["running"]);
    // Let the partial emit land first.
    let deadline = Instant::now() + Duration::from_secs(10);
    while server.get(&format!("/runs/{slow}")).1["outputs"].is_null() {
        assert!(Instant::now() < deadline);
        std::thread::sleep(Duration::from_millis(50));
    }
    assert_eq!(server.get("/health").1["queued"], 1);
    let (status, body) = server.post(&format!("/runs/{slow}/cancel"), json!({}));
    assert_eq!((status, body["status"].as_str()), (202, Some("cancelling")));
    let final_status = server.wait_status(&slow, &["cancelled", "error", "done"]);
    assert_eq!(final_status["status"], "cancelled");
    assert_eq!(final_status["outputs"]["partial"], true);
    assert_eq!(
        types(&server.events(&slow, None)).last(),
        Some(&"cancelled")
    );

    assert_eq!(
        server.wait_status(&queued, &["done", "error"])["status"],
        "done"
    );
    assert_ne!(server.worker_pid(), pid);
    assert!(!pid_alive(pid));

    let (status, body) = server.post(&format!("/runs/{slow}/cancel"), json!({}));
    assert_eq!(status, 409, "{body}");
    assert_eq!(server.post("/runs/nope/cancel", json!({})).0, 404);

    // A queued run can be cancelled without touching the worker.
    let first = server.start_run("slow", json!({ "steps": 20, "delay": 0.1 }));
    let second = server.start_run("echo", json!({}));
    assert_eq!(
        server.post(&format!("/runs/{second}/cancel"), json!({})).0,
        202
    );
    assert_eq!(
        server.wait_status(&second, &["cancelled"])["status"],
        "cancelled"
    );
    assert_eq!(
        server.post(&format!("/runs/{first}/cancel"), json!({})).0,
        202
    );
    server.wait_status(&first, &["cancelled"]);
}

#[test]
fn rejects_bad_requests() {
    let server = Server::start();
    assert_eq!(
        server.post("/tasks/nope/run", json!({ "inputs": {} })).0,
        404
    );
    let (status, body) = server.post("/tasks/echo/run", json!({ "inputs": [1] }));
    assert_eq!(status, 400, "{body}");
    let (status, body) = server.post("/tasks/echo/run", json!({ "inputs": {}, "name": 3 }));
    assert_eq!(status, 400, "{body}");
    assert_eq!(server.get("/runs/nope").0, 404);
    assert_eq!(server.get("/runs/../x").0, 404);
    assert_eq!(server.get("/runs?limit=x").0, 400);
    let run = server.start_run("echo", json!({}));
    server.wait_status(&run, &["done"]);
    assert_eq!(server.get(&format!("/runs/{run}/log?tail=x")).0, 400);
}

#[test]
fn csv_flag_writes_tables() {
    let server = Server::start_with(&["--csv"]);
    let run = server.start_run("echo", json!({ "n": 2 }));
    server.wait_status(&run, &["done"]);
    let (_, files) = server.get(&format!("/runs/{run}/files"));
    let paths: Vec<&str> = files["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["path"].as_str().unwrap())
        .collect();
    assert_eq!(paths, ["series.csv", "x.txt"]);
    let (_, csv) = server.get_text(&format!("/runs/{run}/files/series.csv"));
    assert_eq!(csv, "i,v\n0,0.0\n1,1.5\n");
}

#[cfg(unix)]
#[test]
fn sigterm_stops_the_worker_too() {
    let mut server = Server::start();
    let pid = server.worker_pid();
    assert!(pid_alive(pid));
    let status = Command::new("kill")
        .args(["-TERM", &server.child.id().to_string()])
        .status()
        .unwrap();
    assert!(status.success());
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if let Some(code) = server.child.try_wait().unwrap() {
            assert!(code.success(), "{code}");
            break;
        }
        assert!(Instant::now() < deadline, "server did not exit on SIGTERM");
        std::thread::sleep(Duration::from_millis(50));
    }
    let deadline = Instant::now() + Duration::from_secs(5);
    while pid_alive(pid) {
        assert!(Instant::now() < deadline, "worker outlived the server");
        std::thread::sleep(Duration::from_millis(50));
    }
}

/// A worker written in shell: reports one task `t` and the given `files`, then
/// runs `body` (with `$id` bound to the run id) and answers `done` per run.
#[cfg(unix)]
fn shell_worker(dir: &std::path::Path, files: &[&str], body: &str) -> String {
    use std::os::unix::fs::PermissionsExt;
    let files = files
        .iter()
        .map(|f| format!("{f:?}"))
        .collect::<Vec<_>>()
        .join(",");
    let script = dir.join("worker.sh");
    std::fs::write(
        &script,
        format!(
            "#!/bin/sh\n\
             printf '{{\"type\":\"worker_ready\",\"protocol\":\"1.0\",\"pid\":%d,\
             \"tasks\":[{{\"name\":\"t\",\"params\":[]}}],\"files\":[{files}]}}\\n' $$\n\
             while read -r line; do\n\
             case \"$line\" in *shutdown*) exit 0;; esac\n\
             id=$(printf '%s' \"$line\" | sed 's/.*\"run_id\":\"\\([^\"]*\\)\".*/\\1/')\n\
             {body}\n\
             printf '{{\"type\":\"done\",\"run_id\":\"%s\"}}\\n' \"$id\"\n\
             done\n"
        ),
    )
    .unwrap();
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap();
    script.to_string_lossy().into_owned()
}

#[cfg(unix)]
#[test]
fn reloads_when_a_reported_file_changes() {
    let dir = tempfile::TempDir::new().unwrap();
    let watched = dir.path().join("model.py");
    std::fs::write(&watched, "v1").unwrap();
    let worker = shell_worker(dir.path(), &[&watched.to_string_lossy()], "");
    let server = Server::start_worker(&worker, &[]);
    assert_eq!(server.get("/tasks").1["ready"], true);
    let first = server.worker_pid();
    assert_eq!(server.get("/health").1["worker"]["watching"], 1);

    std::thread::sleep(Duration::from_millis(1100)); // past the first poll
    std::fs::write(&watched, "v2").unwrap();
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let (_, health) = server.get("/health");
        if health["worker"]["reloads"] == 1 && health["worker"]["ready"] == true {
            assert_ne!(health["worker"]["pid"].as_u64().unwrap(), first);
            break;
        }
        assert!(Instant::now() < deadline, "no reload: {health}");
        std::thread::sleep(Duration::from_millis(50));
    }
    assert!(server
        .stderr_lines()
        .iter()
        .any(|l| l.contains("model.py changed; restarting the worker")));
    let run = server.start_run("t", json!({}));
    server.wait_status(&run, &["done"]);
}

#[cfg(unix)]
#[test]
fn worker_exiting_before_ready_fails_instead_of_respawning() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::TempDir::new().unwrap();
    let count = dir.path().join("spawns");
    let script = dir.path().join("die.sh");
    std::fs::write(
        &script,
        format!("#!/bin/sh\necho spawned >> {}\nexit 3\n", count.display()),
    )
    .unwrap();
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap();
    let server = Server::start_worker(&script.to_string_lossy(), &[]);
    let (_, tasks) = server.get("/tasks");
    assert_eq!(tasks["ready"], false, "{tasks}");
    assert!(
        tasks["error"]
            .as_str()
            .unwrap()
            .contains("exited with code 3 before it was ready"),
        "{tasks}"
    );
    let (status, body) = server.post("/tasks/t/run", json!({ "inputs": {} }));
    assert_eq!(status, 503, "{body}");
    std::thread::sleep(Duration::from_millis(500));
    assert_eq!(std::fs::read_to_string(&count).unwrap().lines().count(), 1);
}

#[cfg(unix)]
#[test]
fn identical_submits_in_the_same_second_get_distinct_runs() {
    let dir = tempfile::TempDir::new().unwrap();
    let worker = shell_worker(dir.path(), &[], "");
    let server = Server::start_worker(&worker, &[]);
    assert_eq!(server.get("/tasks").1["ready"], true);
    let ids: Vec<String> = std::thread::scope(|s| {
        let handles: Vec<_> = (0..20)
            .map(|_| s.spawn(|| server.start_run("t", json!({}))))
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });
    let mut unique = ids.clone();
    unique.sort();
    unique.dedup();
    assert_eq!(unique.len(), ids.len(), "{ids:?}");
    for id in &ids {
        server.wait_status(id, &["done"]);
    }
    let (_, health) = server.get("/health");
    assert_eq!(health["worker"]["busy"], false, "{health}");
    assert_eq!(health["queued"], 0, "{health}");
}

#[cfg(unix)]
#[test]
fn worker_exiting_while_idle_fails_instead_of_looping() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::TempDir::new().unwrap();
    let count = dir.path().join("spawns");
    let script = dir.path().join("flaky.sh");
    std::fs::write(
        &script,
        format!(
            "#!/bin/sh
echo spawned >> {}
             printf '{{\"type\":\"worker_ready\",\"protocol\":\"1.0\",\"tasks\":[],\"files\":[]}}\n'
             exit 3
",
            count.display()
        ),
    )
    .unwrap();
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap();
    let server = Server::start_worker(&script.to_string_lossy(), &[]);
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let (_, health) = server.get("/health");
        if let Some(error) = health["worker"]["error"].as_str() {
            assert!(error.contains("3 times in a row"), "{health}");
            break;
        }
        assert!(Instant::now() < deadline, "never failed: {health}");
        std::thread::sleep(Duration::from_millis(50));
    }
    std::thread::sleep(Duration::from_millis(500));
    assert_eq!(std::fs::read_to_string(&count).unwrap().lines().count(), 3);
}

#[cfg(unix)]
#[test]
fn a_run_deleted_mid_run_does_not_wedge_the_queue() {
    let dir = tempfile::TempDir::new().unwrap();
    let worker = shell_worker(dir.path(), &[], "echo before; sleep 1; echo after");
    let server = Server::start_worker(&worker, &[]);
    let run = server.start_run("t", json!({}));
    server.wait_status(&run, &["running"]);
    let run_dir = server._dir.path().join("output").join(&run);
    std::fs::remove_dir_all(&run_dir).unwrap();
    let next = server.start_run("t", json!({}));
    server.wait_status(&next, &["done"]);
    assert!(!run_dir.exists());
    assert_eq!(server.get(&format!("/runs/{run}")).0, 404);
    assert_eq!(server.get("/health").1["worker"]["busy"], false);
}

#[cfg(unix)]
#[test]
fn invalid_utf8_on_stdout_is_logged_not_fatal() {
    let dir = tempfile::TempDir::new().unwrap();
    let worker = shell_worker(dir.path(), &[], "printf 'bad \\377\\376 bytes\\n'");
    let server = Server::start_worker(&worker, &[]);
    let run = server.start_run("t", json!({}));
    server.wait_status(&run, &["done"]);
    let (_, log) = server.get_text(&format!("/runs/{run}/log"));
    assert_eq!(log, "bad \u{fffd}\u{fffd} bytes\n");
    assert_eq!(server.get("/health").1["worker"]["busy"], false);
}

#[cfg(unix)]
#[test]
fn warns_when_the_worker_protocol_major_differs() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::TempDir::new().unwrap();
    let script = dir.path().join("worker.sh");
    std::fs::write(
        &script,
        "#!/bin/sh\nprintf '{\"type\":\"worker_ready\",\"protocol\":\"2.0\",\"pid\":%d,\"tasks\":[],\"files\":[]}\\n' $$\ncat >/dev/null\n",
    )
    .unwrap();
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap();
    let server = Server::start_worker(&script.to_string_lossy(), &[]);
    assert_eq!(server.get("/tasks").1["ready"], true);
    let (_, health) = server.get("/health");
    assert_eq!(health["worker"]["protocol"], "2.0", "{health}");
    let warning = server
        .stderr_lines()
        .into_iter()
        .find(|l| l.contains("protocol 2.0 but this server speaks 1.0"));
    assert!(warning.is_some(), "{:?}", server.stderr_lines());
}

/// The same protocol from the Python worker, including a cancel that has to
/// take down both `uv run` and the interpreter it started.
#[test]
fn python_worker_speaks_the_same_protocol() {
    let Some(worker) = python_worker() else {
        return;
    };
    let server = Server::start_worker(&worker, &[]);
    let (_, tasks) = server.get("/tasks");
    assert_eq!(tasks["ready"], true, "{tasks}");
    let names: Vec<&str> = tasks["tasks"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t["name"].as_str().unwrap())
        .collect();
    assert!(
        names.contains(&"echo") && names.contains(&"prints"),
        "{names:?}"
    );
    let (_, health) = server.get("/health");
    assert_eq!(health["worker"]["protocol"], "1.0");
    assert!(health["worker"]["watching"].as_u64().unwrap() > 0);

    let (status, body) = server.post("/tasks/echo/run", json!({ "inputs": { "bogus": 1 } }));
    assert_eq!(status, 400, "{body}");
    assert!(body["error"]
        .as_str()
        .unwrap()
        .contains("unknown input(s) bogus"));

    let run = server.start_run("echo", json!({ "n": 2, "label": "py" }));
    let events = server.events(&run, None);
    assert_eq!(types(&events), ["status", "progress", "outputs", "done"]);
    let (_, files) = server.get(&format!("/runs/{run}/files"));
    assert_eq!(files["files"][0]["path"], "py.txt");

    let prints = server.start_run("prints", json!({}));
    server.wait_status(&prints, &["done"]);
    let (_, log) = server.get_text(&format!("/runs/{prints}/log"));
    assert_eq!(log, "hello from stdout\n[stderr] 100%\n[task] from ctx\n");

    let raw = server.start_run("raw_stdout", json!({}));
    assert_eq!(types(&server.events(&raw, None)), ["status", "log", "done"]);

    let pid = server.worker_pid();
    let slow = server.start_run("slow", json!({ "steps": 100, "delay": 0.1 }));
    server.wait_status(&slow, &["running"]);
    std::thread::sleep(Duration::from_millis(300));
    assert_eq!(
        server.post(&format!("/runs/{slow}/cancel"), json!({})).0,
        202
    );
    assert_eq!(
        server.wait_status(&slow, &["cancelled", "error", "done"])["status"],
        "cancelled"
    );
    let deadline = Instant::now() + Duration::from_secs(5);
    while pid_alive(pid) {
        assert!(Instant::now() < deadline, "uv run outlived the cancel");
        std::thread::sleep(Duration::from_millis(50));
    }
    let again = server.start_run("echo", json!({}));
    assert_eq!(
        server.wait_status(&again, &["done", "error"])["status"],
        "done"
    );
}

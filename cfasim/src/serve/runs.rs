//! On-disk run store: `output/<run_id>/` directories and their status.json.

use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Local, SecondsFormat};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};

use super::events;

pub const INPUTS_FILENAME: &str = "inputs.json";
pub const STATUS_FILENAME: &str = "status.json";
pub const LOG_FILENAME: &str = "log.txt";
pub const OUTPUTS_FILENAME: &str = "outputs.cfasim";

/// Files the server owns; everything else in a run dir belongs to the task.
const SERVER_FILES: [&str; 5] = [
    INPUTS_FILENAME,
    STATUS_FILENAME,
    LOG_FILENAME,
    OUTPUTS_FILENAME,
    "outputs.cfasim.tmp",
];

const NAME_MAX_LENGTH: usize = 40;

pub const QUEUED: &str = "queued";
pub const RUNNING: &str = "running";

pub type Status = Map<String, Value>;

pub fn status_str<'a>(status: &'a Status, key: &str) -> &'a str {
    status.get(key).and_then(Value::as_str).unwrap_or("")
}

fn valid_run_id(run_id: &str) -> bool {
    let mut chars = run_id.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_alphanumeric())
        && chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
}

/// A run name as a safe directory prefix: letters, digits, `-` and `_`.
pub fn slugify_name(name: Option<&str>) -> Option<String> {
    let name = name?.trim();
    let mut slug = String::new();
    let mut pending_dash = false;
    for c in name.chars() {
        if c.is_ascii_alphanumeric() || matches!(c, '_' | '-') {
            if pending_dash && !slug.is_empty() {
                slug.push('-');
            }
            pending_dash = false;
            slug.push(c);
        } else {
            pending_dash = true;
        }
    }
    // Trim before truncating too, so leading separators don't use up the length.
    let slug: String = slug
        .trim_matches(['-', '_'])
        .chars()
        .take(NAME_MAX_LENGTH)
        .collect();
    let slug = slug.trim_matches(['-', '_']).to_string();
    if slug.is_empty() {
        None
    } else {
        Some(slug)
    }
}

/// Stable 16-hex digest of JSON inputs (sorted keys, compact separators).
pub fn inputs_hash(inputs: &Value) -> String {
    let payload = serde_json::to_string(inputs).unwrap_or_default();
    let digest = Sha256::digest(payload.as_bytes());
    digest
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>()[..16]
        .to_string()
}

pub struct RunStore {
    pub root: PathBuf,
}

impl RunStore {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        let root = root.into();
        let _ = fs::create_dir_all(&root);
        Self { root }
    }

    pub fn run_dir(&self, run_id: &str) -> Option<PathBuf> {
        valid_run_id(run_id).then(|| self.root.join(run_id))
    }

    pub fn exists(&self, run_id: &str) -> bool {
        self.run_dir(run_id)
            .map(|d| d.join(STATUS_FILENAME).is_file())
            .unwrap_or(false)
    }

    /// Claim a fresh run directory. `create_dir` fails on an existing one, so
    /// two identical submits in the same second still get distinct ids;
    /// `taken` skips ids still in use whose directory was deleted.
    fn claim_run_dir(
        &self,
        digest: &str,
        now: DateTime<Local>,
        slug: Option<&str>,
        taken: &dyn Fn(&str) -> bool,
    ) -> std::io::Result<(String, PathBuf)> {
        let mut base = format!("{}-{}", now.format("%Y%m%d-%H%M%S"), &digest[..6]);
        if let Some(slug) = slug {
            base = format!("{slug}-{base}");
        }
        // The output directory may have been deleted meanwhile.
        fs::create_dir_all(&self.root)?;
        let mut run_id = base.clone();
        for n in 2.. {
            let dir = self.root.join(&run_id);
            match fs::create_dir(&dir) {
                Ok(()) if !taken(&run_id) => return Ok((run_id, dir)),
                Ok(()) => {
                    let _ = fs::remove_dir(&dir);
                }
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
                Err(e) => return Err(e),
            }
            run_id = format!("{base}-{n}");
        }
        unreachable!()
    }

    pub fn create(
        &self,
        task: &str,
        inputs: &Value,
        name: Option<&str>,
        taken: &dyn Fn(&str) -> bool,
    ) -> std::io::Result<Status> {
        let digest = inputs_hash(inputs);
        let now = Local::now();
        let slug = slugify_name(name);
        let (run_id, run_dir) = self.claim_run_dir(&digest, now, slug.as_deref(), taken)?;
        fs::write(
            run_dir.join(INPUTS_FILENAME),
            serde_json::to_string_pretty(inputs)? + "\n",
        )?;
        let name = name.map(str::trim).filter(|n| !n.is_empty());
        let status = json!({
            "run_id": run_id,
            "name": name,
            "task": task,
            "inputs_hash": digest,
            "status": QUEUED,
            "created_at": events::iso(now),
            "started_at": null,
            "finished_at": null,
            "progress": null,
            "outputs": null,
            "error": null,
        });
        let Value::Object(status) = status else {
            unreachable!()
        };
        self.write_status(&run_id, &status);
        Ok(status)
    }

    pub fn read_status(&self, run_id: &str) -> Option<Status> {
        let path = self.run_dir(run_id)?.join(STATUS_FILENAME);
        let text = fs::read_to_string(path).ok()?;
        match serde_json::from_str(&text).ok()? {
            Value::Object(status) => Some(status),
            _ => None,
        }
    }

    /// Write status.json; `false` when the run directory is gone.
    pub fn write_status(&self, run_id: &str, status: &Status) -> bool {
        let Some(dir) = self.run_dir(run_id) else {
            return false;
        };
        if !dir.is_dir() {
            return false;
        }
        let path = dir.join(STATUS_FILENAME);
        let tmp = dir.join(format!("{STATUS_FILENAME}.tmp"));
        let Ok(text) = serde_json::to_string_pretty(status) else {
            return false;
        };
        fs::write(&tmp, text + "\n").is_ok() && fs::rename(&tmp, &path).is_ok()
    }

    pub fn read_inputs(&self, run_id: &str) -> Option<Value> {
        let path = self.run_dir(run_id)?.join(INPUTS_FILENAME);
        let text = fs::read_to_string(path).ok()?;
        serde_json::from_str(&text).ok()
    }

    /// log.txt opened for appending; `None` when the run directory is gone.
    pub fn open_log(&self, run_id: &str) -> Option<fs::File> {
        fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(self.run_dir(run_id)?.join(LOG_FILENAME))
            .ok()
    }

    pub fn list_runs(&self, task: Option<&str>, limit: usize) -> Vec<Status> {
        let Ok(entries) = fs::read_dir(&self.root) else {
            let _ = fs::create_dir_all(&self.root);
            return Vec::new();
        };
        let mut statuses: Vec<Status> = entries
            .flatten()
            .filter(|e| e.path().is_dir())
            .filter_map(|e| self.read_status(&e.file_name().to_string_lossy()))
            .filter(|s| task.map_or(true, |t| status_str(s, "task") == t))
            .collect();
        statuses.sort_by(|a, b| status_str(b, "created_at").cmp(status_str(a, "created_at")));
        statuses.truncate(limit);
        statuses
    }

    /// Runs left queued/running by a previous server session can never finish.
    pub fn mark_stale(&self) {
        for mut status in self.list_runs(None, usize::MAX) {
            if matches!(status_str(&status, "status"), QUEUED | RUNNING) {
                status.insert("status".into(), events::ERROR.into());
                status.insert("finished_at".into(), events::now_iso().into());
                status.insert(
                    "error".into(),
                    json!({ "message": "the server stopped before this run finished", "traceback": null }),
                );
                let run_id = status_str(&status, "run_id").to_string();
                self.write_status(&run_id, &status);
            }
        }
    }

    pub fn list_files(&self, run_id: &str) -> Vec<Value> {
        let mut files = Vec::new();
        let Some(run_dir) = self.run_dir(run_id) else {
            return files;
        };
        if !run_dir.is_dir() {
            return files;
        }
        let mut paths = Vec::new();
        walk_files(&run_dir, &|_| true, &mut paths);
        paths.sort();
        for path in paths {
            let Ok(rel) = path.strip_prefix(&run_dir) else {
                continue;
            };
            let rel = rel
                .components()
                .map(|c| c.as_os_str().to_string_lossy())
                .collect::<Vec<_>>()
                .join("/");
            if SERVER_FILES.contains(&rel.as_str()) {
                continue;
            }
            let Ok(meta) = path.metadata() else { continue };
            let modified = meta
                .modified()
                .map(|m| DateTime::<Local>::from(m).to_rfc3339_opts(SecondsFormat::Secs, false))
                .unwrap_or_default();
            files.push(json!({ "path": rel, "size": meta.len(), "modified": modified }));
        }
        files
    }

    /// Resolve a user file inside the run dir; `None` if it escapes or is missing.
    pub fn resolve_file(&self, run_id: &str, rel: &str) -> Option<PathBuf> {
        let run_dir = self.run_dir(run_id)?.canonicalize().ok()?;
        let candidate = run_dir.join(rel).canonicalize().ok()?;
        (candidate.starts_with(&run_dir) && candidate != run_dir && candidate.is_file())
            .then_some(candidate)
    }
}

/// Every file under `dir`, descending into subdirectories `enter` accepts by name.
pub fn walk_files(dir: &Path, enter: &dyn Fn(&str) -> bool, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if enter(&entry.file_name().to_string_lossy()) {
                walk_files(&path, enter, out);
            }
        } else if path.is_file() {
            out.push(path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn slugs() {
        assert_eq!(
            slugify_name(Some("wide prior")).as_deref(),
            Some("wide-prior")
        );
        assert_eq!(slugify_name(Some("  a / b  ")).as_deref(), Some("a-b"));
        assert_eq!(slugify_name(Some("***")), None);
        assert_eq!(slugify_name(Some("")), None);
        assert_eq!(slugify_name(None), None);
        let long = "x".repeat(60);
        assert_eq!(slugify_name(Some(&long)).unwrap().len(), NAME_MAX_LENGTH);
        let padded = format!("{} calibration", "_".repeat(50));
        assert_eq!(slugify_name(Some(&padded)).as_deref(), Some("calibration"));
    }

    #[test]
    fn hash_is_sorted_and_compact() {
        let a = inputs_hash(&json!({ "b": 1, "a": [1, 2] }));
        let b = inputs_hash(&json!({ "a": [1, 2], "b": 1 }));
        assert_eq!(a, b);
        assert_eq!(a.len(), 16);
        // Pinned: run ids and the documented `inputs_hash` depend on it.
        assert_eq!(a, "94a786c3662bc7be");
    }

    #[test]
    fn create_list_and_files() {
        let dir = tempfile::TempDir::new().unwrap();
        let store = RunStore::new(dir.path().join("output"));
        let status = store
            .create("echo", &json!({ "n": 2 }), Some("my run"), &|_| false)
            .unwrap();
        let run_id = status_str(&status, "run_id").to_string();
        assert!(run_id.starts_with("my-run-"));
        assert_eq!(status_str(&status, "status"), QUEUED);
        assert_eq!(status["name"], "my run");
        assert_eq!(store.read_status(&run_id).unwrap(), status);
        assert_eq!(store.read_inputs(&run_id).unwrap(), json!({ "n": 2 }));

        let run_dir = store.run_dir(&run_id).unwrap();
        fs::create_dir_all(run_dir.join("figs")).unwrap();
        fs::write(run_dir.join("figs/a.png"), b"x").unwrap();
        fs::write(run_dir.join("note.txt"), b"hi").unwrap();
        let files: Vec<String> = store
            .list_files(&run_id)
            .iter()
            .map(|f| f["path"].as_str().unwrap().to_string())
            .collect();
        assert_eq!(files, vec!["figs/a.png", "note.txt"]);
        assert!(store.resolve_file(&run_id, "note.txt").is_some());
        assert!(store.resolve_file(&run_id, "../other").is_none());
        assert!(store.resolve_file(&run_id, "missing").is_none());
        assert!(store.resolve_file("../etc", "passwd").is_none());

        let second = store
            .create("echo", &json!({ "n": 2 }), None, &|_| false)
            .unwrap();
        let runs = store.list_runs(None, 50);
        assert_eq!(runs.len(), 2);
        assert_eq!(store.list_runs(Some("other"), 50).len(), 0);
        assert_eq!(store.list_runs(None, 1).len(), 1);
        assert!(status_str(&second, "run_id").starts_with("20"));

        writeln!(store.open_log(&run_id).unwrap(), "hello").unwrap();
        assert_eq!(
            fs::read_to_string(run_dir.join(LOG_FILENAME)).unwrap(),
            "hello\n"
        );
    }

    #[test]
    fn same_second_runs_get_distinct_ids() {
        let dir = tempfile::TempDir::new().unwrap();
        let store = std::sync::Arc::new(RunStore::new(dir.path()));
        let threads: Vec<_> = (0..16)
            .map(|_| {
                let store = store.clone();
                std::thread::spawn(move || {
                    let status = store
                        .create("echo", &json!({ "n": 0 }), None, &|_| false)
                        .unwrap();
                    status_str(&status, "run_id").to_string()
                })
            })
            .collect();
        let mut ids: Vec<String> = threads.into_iter().map(|t| t.join().unwrap()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), 16);
    }

    #[test]
    fn stale_runs_become_errors() {
        let dir = tempfile::TempDir::new().unwrap();
        let store = RunStore::new(dir.path());
        let mut status = store.create("echo", &json!({}), None, &|_| false).unwrap();
        let run_id = status_str(&status, "run_id").to_string();
        status.insert("status".into(), RUNNING.into());
        store.write_status(&run_id, &status);
        store.mark_stale();
        let after = store.read_status(&run_id).unwrap();
        assert_eq!(status_str(&after, "status"), events::ERROR);
        assert!(after["error"]["message"]
            .as_str()
            .unwrap()
            .contains("server stopped"));
    }

    #[test]
    fn invalid_ids_are_rejected() {
        let dir = tempfile::TempDir::new().unwrap();
        let store = RunStore::new(dir.path());
        assert!(store.run_dir("../x").is_none());
        assert!(store.run_dir("").is_none());
        assert!(store.run_dir("a/b").is_none());
        assert!(store.read_status("..").is_none());
    }
}

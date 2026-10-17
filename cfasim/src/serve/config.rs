//! How a project's worker is started: the command, what to build first, and
//! which files to watch for a reload.

use std::path::{Path, PathBuf};
use std::process::Stdio;

use anyhow::{anyhow, bail, Context, Result};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Runtime {
    Python,
    Rust,
}

#[derive(Debug, Clone)]
pub struct WorkerSpec {
    /// Program and arguments; empty when `build` supplies the executable.
    pub command: Vec<String>,
    pub cwd: PathBuf,
    /// Arguments after `cargo build` for a worker binary built first.
    pub build: Option<Vec<String>>,
    /// Appended to the error when the worker cannot be started.
    pub spawn_hint: &'static str,
    /// Files and directories whose changes restart the worker.
    pub watch: Vec<PathBuf>,
    /// What to print at startup.
    pub label: String,
}

impl WorkerSpec {
    /// A fixed command with no build step.
    pub fn command(command: Vec<String>, cwd: PathBuf) -> Self {
        let label = command.join(" ");
        Self {
            command,
            cwd,
            build: None,
            spawn_hint: "",
            watch: Vec::new(),
            label,
        }
    }

    /// The command to spawn, building first when the spec asks for it.
    pub async fn prepare(&self) -> Result<Vec<String>> {
        match &self.build {
            Some(build) => {
                let exe = cargo_build(build, &self.cwd).await?;
                Ok(vec![exe.to_string_lossy().into_owned()])
            }
            None => Ok(self.command.clone()),
        }
    }
}

/// Which runtime a project directory uses; python wins when both manifests exist.
pub fn detect_runtime(dir: &Path) -> Option<Runtime> {
    if dir.join("pyproject.toml").is_file() {
        Some(Runtime::Python)
    } else if dir.join("Cargo.toml").is_file() {
        Some(Runtime::Rust)
    } else {
        None
    }
}

fn toml_string(doc: &toml_edit::DocumentMut, path: &[&str]) -> Option<String> {
    let mut item: &toml_edit::Item = doc.as_item();
    for key in path {
        item = item.get(key)?;
    }
    item.as_str().map(str::to_string)
}

/// Resolve the worker for a project: `--tasks` overrides the manifest, which
/// overrides the conventional location.
pub fn resolve(
    dir: &Path,
    runtime: Runtime,
    tasks: Option<&str>,
    release: bool,
) -> Result<WorkerSpec> {
    match runtime {
        Runtime::Python => resolve_python(dir, tasks),
        Runtime::Rust => resolve_rust(dir, tasks, release),
    }
}

fn resolve_python(dir: &Path, tasks: Option<&str>) -> Result<WorkerSpec> {
    let manifest = std::fs::read_to_string(dir.join("pyproject.toml")).unwrap_or_default();
    let doc = manifest.parse::<toml_edit::DocumentMut>().ok();
    let spec = match tasks {
        Some(t) => t.to_string(),
        None => doc
            .as_ref()
            .and_then(|d| toml_string(d, &["tool", "cfasim", "tasks"]))
            .or_else(|| find_python_tasks(dir))
            .ok_or_else(|| {
                anyhow!(
                    "no task module found: add a tasks.py (or src/<package>/tasks.py), \
                     set [tool.cfasim] tasks = \"package.tasks\" in pyproject.toml, \
                     or pass --tasks"
                )
            })?,
    };
    let watch = python_watch(dir, &spec).into_iter().collect();
    let command = vec![
        "uv".to_string(),
        "run".to_string(),
        "python".to_string(),
        "-m".to_string(),
        "cfasim_model.server.worker".to_string(),
        spec.clone(),
    ];
    Ok(WorkerSpec {
        command,
        cwd: dir.to_path_buf(),
        build: None,
        spawn_hint: " (is uv installed and cfasim-model in your dependencies?)",
        watch,
        label: format!("python tasks from {spec}"),
    })
}

/// What to watch for a task spec: the file itself, or the top-level package
/// (or module) a dotted spec names, so a module that fails to import at
/// startup still reloads once it is fixed.
fn python_watch(dir: &Path, spec: &str) -> Option<PathBuf> {
    if spec.ends_with(".py") {
        return Some(dir.join(spec));
    }
    let top = spec.split('.').next()?;
    [dir.join("src"), dir.to_path_buf()]
        .into_iter()
        .flat_map(|base| [base.join(top), base.join(format!("{top}.py"))])
        .find(|p| p.exists())
}

/// `tasks.py` at the root, else a single `src/<package>/tasks.py` as `package.tasks`.
fn find_python_tasks(dir: &Path) -> Option<String> {
    if dir.join("tasks.py").is_file() {
        return Some("tasks.py".to_string());
    }
    let mut found = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir.join("src")) {
        for entry in entries.flatten() {
            if entry.path().join("tasks.py").is_file() {
                found.push(entry.file_name().to_string_lossy().into_owned());
            }
        }
    }
    match found.as_slice() {
        [package] => Some(format!("{package}.tasks")),
        _ => None,
    }
}

fn resolve_rust(dir: &Path, tasks: Option<&str>, release: bool) -> Result<WorkerSpec> {
    let manifest = std::fs::read_to_string(dir.join("Cargo.toml")).unwrap_or_default();
    let doc = manifest.parse::<toml_edit::DocumentMut>().ok();
    let bin = match tasks {
        Some(t) => Some(t.to_string()),
        None => doc
            .as_ref()
            .and_then(|d| toml_string(d, &["package", "metadata", "cfasim", "tasks"])),
    };
    let mut args = Vec::new();
    if release {
        args.push("--release".to_string());
    }
    if let Some(bin) = &bin {
        args.push("--bin".to_string());
        args.push(bin.clone());
    }
    let label = match &bin {
        Some(bin) => format!("rust tasks binary `{bin}`"),
        None => "rust tasks binary".to_string(),
    };
    Ok(WorkerSpec {
        command: Vec::new(),
        cwd: dir.to_path_buf(),
        build: Some(args),
        spawn_hint: "",
        watch: vec![
            dir.join("src"),
            dir.join("Cargo.toml"),
            dir.join("build.rs"),
        ],
        label,
    })
}

/// Run `cargo build` and return the executable it produced. Diagnostics and
/// progress go to the terminal; the JSON message stream on stdout names the
/// artifact, so the target directory never has to be guessed.
pub async fn cargo_build(args: &[String], cwd: &Path) -> Result<PathBuf> {
    let mut cmd = tokio::process::Command::new("cargo");
    cmd.arg("build")
        .args(args)
        .arg("--message-format=json-render-diagnostics")
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit());
    let output = cmd
        .output()
        .await
        .context("failed to run cargo (is it installed?)")?;
    if !output.status.success() {
        bail!("cargo build failed");
    }
    let mut executables = Vec::new();
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let Ok(message) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        if message["reason"] != "compiler-artifact" {
            continue;
        }
        if let Some(exe) = message["executable"].as_str() {
            let name = message["target"]["name"].as_str().unwrap_or("").to_string();
            executables.push((name, PathBuf::from(exe)));
        }
    }
    match executables.as_slice() {
        [(_, exe)] => Ok(exe.clone()),
        [] => bail!("cargo build produced no executable: the tasks binary needs a src/main.rs or a [[bin]] target"),
        many => {
            let names: Vec<&str> = many.iter().map(|(n, _)| n.as_str()).collect();
            bail!(
                "cargo build produced several executables ({}); choose one with --tasks <name> \
                 or [package.metadata.cfasim] tasks = \"<name>\"",
                names.join(", ")
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(dir: &Path, name: &str, content: &str) {
        if let Some(parent) = dir.join(name).parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(dir.join(name), content).unwrap();
    }

    #[test]
    fn python_tasks_resolution_order() {
        let dir = tempfile::TempDir::new().unwrap();
        let d = dir.path();
        write(d, "pyproject.toml", "[project]\nname = 'x'\n");
        assert!(resolve(d, Runtime::Python, None, true).is_err());

        write(d, "src/my_pkg/tasks.py", "");
        let spec = resolve(d, Runtime::Python, None, true).unwrap();
        assert_eq!(spec.command.last().unwrap(), "my_pkg.tasks");
        assert_eq!(spec.watch, vec![d.join("src/my_pkg")]);

        write(d, "tasks.py", "");
        let spec = resolve(d, Runtime::Python, None, true).unwrap();
        assert_eq!(spec.command.last().unwrap(), "tasks.py");
        assert_eq!(spec.watch, vec![d.join("tasks.py")]);

        write(
            d,
            "pyproject.toml",
            "[project]\nname = 'x'\n[tool.cfasim]\ntasks = 'other.tasks'\n",
        );
        let spec = resolve(d, Runtime::Python, None, true).unwrap();
        assert_eq!(spec.command.last().unwrap(), "other.tasks");
        assert!(spec.watch.is_empty());
        write(d, "other.py", "");
        let spec = resolve(d, Runtime::Python, None, true).unwrap();
        assert_eq!(spec.watch, vec![d.join("other.py")]);

        let spec = resolve(d, Runtime::Python, Some("cli.py"), true).unwrap();
        assert_eq!(
            spec.command[..5],
            ["uv", "run", "python", "-m", "cfasim_model.server.worker"]
        );
        assert_eq!(spec.command.last().unwrap(), "cli.py");
    }

    #[test]
    fn rust_bin_from_metadata_or_flag() {
        let dir = tempfile::TempDir::new().unwrap();
        let d = dir.path();
        write(d, "Cargo.toml", "[package]\nname = \"x\"\n");
        let spec = resolve(d, Runtime::Rust, None, false).unwrap();
        assert!(spec.build.unwrap().is_empty());
        assert!(spec.watch.contains(&d.join("src")));

        write(
            d,
            "Cargo.toml",
            "[package]\nname = \"x\"\n[package.metadata.cfasim]\ntasks = \"tasks\"\n",
        );
        let spec = resolve(d, Runtime::Rust, None, true).unwrap();
        assert_eq!(spec.build.unwrap(), vec!["--release", "--bin", "tasks"]);

        let spec = resolve(d, Runtime::Rust, Some("other"), true).unwrap();
        assert_eq!(spec.build.unwrap(), vec!["--release", "--bin", "other"]);
    }

    #[test]
    fn runtime_detection() {
        let dir = tempfile::TempDir::new().unwrap();
        assert_eq!(detect_runtime(dir.path()), None);
        write(dir.path(), "Cargo.toml", "");
        assert_eq!(detect_runtime(dir.path()), Some(Runtime::Rust));
        write(dir.path(), "pyproject.toml", "");
        assert_eq!(detect_runtime(dir.path()), Some(Runtime::Python));
    }
}

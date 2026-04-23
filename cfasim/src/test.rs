use anyhow::{bail, Context, Result};
use std::path::Path;
use std::process::{Command, ExitStatus};

use crate::project::{self, Kind, Project};

pub fn run(unit_flag: bool, e2e_flag: bool) -> Result<()> {
    let cwd = std::env::current_dir().context("failed to read current directory")?;
    let Some(project) = project::detect(&cwd) else {
        bail!(
            "not inside a cfasim project (expected package.json with cfasim-ui \
             dep, plus pyproject.toml or Cargo.toml)"
        );
    };

    // No flags → both. Explicit flags narrow the run.
    let do_unit = unit_flag || !e2e_flag;
    let do_e2e = e2e_flag || !unit_flag;

    if do_unit {
        run_unit(&cwd, &project)?;
    }
    if do_e2e {
        run_e2e(&cwd, &project)?;
    }
    Ok(())
}

fn run_unit(cwd: &Path, project: &Project) -> Result<()> {
    match project.kind {
        Kind::Python => {
            print_header("Unit tests — uv run pytest");
            spawn_and_wait(Command::new("uv").args(["run", "pytest"]).current_dir(cwd))
                .context("failed to spawn `uv run pytest` (is uv installed?)")?
                .check("unit tests")
        }
        Kind::Rust => {
            print_header("Unit tests — cargo test");
            spawn_and_wait(Command::new("cargo").arg("test").current_dir(cwd))
                .context("failed to spawn `cargo test` (is cargo installed?)")?
                .check("unit tests")
        }
    }
}

fn run_e2e(cwd: &Path, project: &Project) -> Result<()> {
    if !project.has_playwright {
        eprintln!("\n\x1b[33mNo playwright.config.* found — skipping e2e tests.\x1b[0m");
        return Ok(());
    }
    print_header("E2E tests — pnpm test:e2e");
    run_pnpm(&["test:e2e"], cwd)
        .context("failed to spawn `pnpm test:e2e` (is pnpm installed?)")?
        .check("e2e tests")
}

fn print_header(title: &str) {
    println!("\n\x1b[1;36m━━ {} ━━\x1b[0m\n", title);
}

/// Spawn a child that inherits stdio (so output streams live to the terminal)
/// and wait for it. Ctrl+C in the terminal is delivered by the OS to the whole
/// foreground process group, so both this process and the child receive SIGINT
/// naturally — no extra wiring needed to stop the chain on cancellation.
fn spawn_and_wait(cmd: &mut Command) -> std::io::Result<ExitCheck> {
    let mut child = cmd.spawn()?;
    let status = child.wait()?;
    Ok(ExitCheck(status))
}

/// pnpm ships on Windows as a corepack `.cmd` shim that CreateProcessW won't
/// resolve from PATHEXT; try the base name first, then fall back.
fn run_pnpm(args: &[&str], cwd: &Path) -> std::io::Result<ExitCheck> {
    match spawn_and_wait(Command::new("pnpm").args(args).current_dir(cwd)) {
        Ok(ec) => Ok(ec),
        Err(e) if cfg!(windows) => {
            spawn_and_wait(Command::new("pnpm.cmd").args(args).current_dir(cwd)).map_err(|_| e)
        }
        Err(e) => Err(e),
    }
}

struct ExitCheck(ExitStatus);

impl ExitCheck {
    fn check(self, label: &str) -> Result<()> {
        if self.0.success() {
            return Ok(());
        }
        if let Some(code) = self.0.code() {
            bail!("{label} failed (exit code {code})");
        }
        // No code usually means signaled (e.g. SIGINT from Ctrl+C).
        bail!("{label} terminated by signal");
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::process::ExitStatusExt;

    #[test]
    fn check_success_is_ok() {
        assert!(ExitCheck(ExitStatus::from_raw(0)).check("x").is_ok());
    }

    #[test]
    fn check_nonzero_code_errors() {
        let err = ExitCheck(ExitStatus::from_raw(1 << 8))
            .check("unit tests")
            .unwrap_err()
            .to_string();
        assert!(err.contains("unit tests failed"));
        assert!(err.contains("exit code 1"));
    }

    #[test]
    fn check_signal_errors() {
        // Low byte = signal number (SIGINT=2), no core dump bit.
        let err = ExitCheck(ExitStatus::from_raw(2))
            .check("e2e tests")
            .unwrap_err()
            .to_string();
        assert!(err.contains("terminated by signal"));
    }
}

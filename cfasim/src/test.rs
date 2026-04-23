use anyhow::{Context, Result};
use std::path::Path;
use std::process::Command;

use crate::proc::{run_pnpm, section, spawn_and_wait, warn};
use crate::project::{self, Kind, Project};

pub fn run(unit_flag: bool, e2e_flag: bool) -> Result<()> {
    let cwd = std::env::current_dir().context("failed to read current directory")?;
    let project = project::detect_or_fail(&cwd)?;

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
            section("Unit tests — uv run pytest");
            spawn_and_wait(Command::new("uv").args(["run", "pytest"]).current_dir(cwd))
                .context("failed to spawn `uv run pytest` (is uv installed?)")?
                .check("unit tests")
        }
        Kind::Rust => {
            section("Unit tests — cargo test");
            spawn_and_wait(Command::new("cargo").arg("test").current_dir(cwd))
                .context("failed to spawn `cargo test` (is cargo installed?)")?
                .check("unit tests")
        }
    }
}

fn run_e2e(cwd: &Path, project: &Project) -> Result<()> {
    if !project.has_playwright {
        warn("No playwright.config.* found — skipping e2e tests.");
        return Ok(());
    }
    section("E2E tests — pnpm test:e2e");
    run_pnpm(&["test:e2e"], cwd)
        .context("failed to spawn `pnpm test:e2e` (is pnpm installed?)")?
        .check("e2e tests")
}

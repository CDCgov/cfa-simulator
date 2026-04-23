use anyhow::{Context, Result};

use crate::proc::{run_pnpm, section};
use crate::project;

pub fn run(extra_args: Vec<String>) -> Result<()> {
    let cwd = std::env::current_dir().context("failed to read current directory")?;
    project::detect_or_fail(&cwd)?;

    // The `--` separator stops pnpm from eating the flags and forwards them to vite.
    let mut args: Vec<&str> = vec!["run", "dev"];
    if !extra_args.is_empty() {
        args.push("--");
        args.extend(extra_args.iter().map(String::as_str));
    }

    section("Dev server — pnpm run dev");
    run_pnpm(&args, &cwd)
        .context("failed to spawn `pnpm run dev` (is pnpm installed?)")?
        .check("dev server")
}

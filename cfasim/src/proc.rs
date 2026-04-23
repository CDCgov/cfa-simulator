use anyhow::{bail, Result};
use std::path::Path;
use std::process::{Command, ExitStatus};

pub struct ExitCheck(ExitStatus);

impl ExitCheck {
    pub fn success(&self) -> bool {
        self.0.success()
    }

    pub fn check(self, label: &str) -> Result<()> {
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

/// Spawn a child that inherits stdio (so output streams live to the terminal)
/// and wait for it. Ctrl+C in the terminal is delivered by the OS to the whole
/// foreground process group, so both this process and the child receive SIGINT
/// naturally — no extra wiring needed to stop on cancellation.
pub fn spawn_and_wait(cmd: &mut Command) -> std::io::Result<ExitCheck> {
    let mut child = cmd.spawn()?;
    let status = child.wait()?;
    Ok(ExitCheck(status))
}

/// Print a bold cyan section banner to stderr so it doesn't interleave with
/// the child's stdout when the user pipes cfasim's output.
pub fn section(title: &str) {
    eprintln!("\n\x1b[1;36m━━ {title} ━━\x1b[0m\n");
}

/// Print a yellow warning line to stderr (also non-interleaving under a pipe).
pub fn warn(msg: &str) {
    eprintln!("\n\x1b[33m{msg}\x1b[0m");
}

/// pnpm ships on Windows as a corepack `.cmd` shim that CreateProcessW won't
/// resolve from PATHEXT; try the base name first, then fall back.
pub fn run_pnpm(args: &[&str], cwd: &Path) -> std::io::Result<ExitCheck> {
    match spawn_and_wait(Command::new("pnpm").args(args).current_dir(cwd)) {
        Ok(ec) => Ok(ec),
        Err(e) if cfg!(windows) => {
            spawn_and_wait(Command::new("pnpm.cmd").args(args).current_dir(cwd)).map_err(|_| e)
        }
        Err(e) => Err(e),
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

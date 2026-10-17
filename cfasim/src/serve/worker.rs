//! The worker child process: spawned in its own process group with a JSON
//! command pipe on stdin and a JSON event stream on stdout.

use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use serde_json::Value;
use tokio::io::AsyncWriteExt;
use tokio::process::{Child, ChildStdout, Command};
use tokio::sync::{mpsc, watch};

pub struct WorkerHandle {
    pub pid: u32,
    commands: mpsc::UnboundedSender<String>,
    exited: watch::Receiver<bool>,
}

pub struct Spawned {
    pub handle: WorkerHandle,
    pub child: Child,
    pub stdout: ChildStdout,
    pub exited: watch::Sender<bool>,
}

pub fn spawn(command: &[String], cwd: &Path) -> std::io::Result<Spawned> {
    let (program, args) = command
        .split_first()
        .ok_or_else(|| std::io::Error::other("empty worker command"))?;
    let mut cmd = Command::new(program);
    cmd.args(args)
        .current_dir(cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit());
    // Its own group, so cancelling kills a launcher (`uv run`) together with
    // the interpreter it started, and terminal Ctrl+C reaches only the server.
    #[cfg(unix)]
    cmd.process_group(0);
    let mut child = cmd.spawn()?;
    let pid = child.id().unwrap_or(0);
    let mut stdin = child.stdin.take().expect("piped stdin");
    let stdout = child.stdout.take().expect("piped stdout");
    let (commands, mut rx) = mpsc::unbounded_channel::<String>();
    tokio::spawn(async move {
        while let Some(line) = rx.recv().await {
            if stdin.write_all(line.as_bytes()).await.is_err() {
                break;
            }
        }
    });
    let (exited_tx, exited) = watch::channel(false);
    Ok(Spawned {
        handle: WorkerHandle {
            pid,
            commands,
            exited,
        },
        child,
        stdout,
        exited: exited_tx,
    })
}

impl WorkerHandle {
    pub fn send(&self, command: Value) {
        let _ = self.commands.send(command.to_string() + "\n");
    }

    pub fn has_exited(&self) -> bool {
        *self.exited.borrow()
    }

    /// Wait for the process to exit; `false` on timeout.
    pub async fn wait_exit(&self, timeout: Duration) -> bool {
        let mut rx = self.exited.clone();
        tokio::time::timeout(timeout, rx.wait_for(|e| *e))
            .await
            .map(|r| r.is_ok())
            .unwrap_or(false)
    }

    /// Stop the worker and everything it started; no grace, it has nothing to flush.
    pub fn kill(&self) {
        if self.has_exited() || self.pid == 0 {
            return;
        }
        #[cfg(unix)]
        {
            // SAFETY: plain libc call on a pid we spawned (its process group id).
            unsafe {
                libc::kill(-(self.pid as i32), libc::SIGKILL);
            }
        }
        #[cfg(windows)]
        {
            let _ = std::process::Command::new("taskkill")
                .args(["/PID", &self.pid.to_string(), "/T", "/F"])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
    }

    /// Let an idle worker exit on its own (running its cleanup), then make sure
    /// it is gone.
    pub async fn retire(&self) {
        self.send(serde_json::json!({ "cmd": "shutdown" }));
        if !self.wait_exit(Duration::from_secs(2)).await {
            self.kill();
        }
    }
}

use anyhow::Result;
use semver::Version;
use std::process::Command;

struct MinVersion {
    node: Version,
    pnpm: Version,
    uv: Version,
    cargo: Version,
    wasm_pack: Version,
}

fn min_versions() -> MinVersion {
    MinVersion {
        node: Version::new(24, 0, 0),
        pnpm: Version::new(10, 0, 0),
        uv: Version::new(0, 5, 0),
        cargo: Version::new(1, 80, 0),
        wasm_pack: Version::new(0, 13, 0),
    }
}

#[derive(Debug)]
enum Status {
    Ok(Version),
    Outdated { found: Version, min: Version },
    Missing,
}

impl Status {
    fn is_ok(&self) -> bool {
        matches!(self, Status::Ok(_))
    }
}

fn parse_first_semver(s: &str) -> Option<Version> {
    for token in s.split(|c: char| !c.is_ascii_digit() && c != '.') {
        let trimmed = token.trim_matches('.');
        if trimmed.is_empty() {
            continue;
        }
        let parts: Vec<&str> = trimmed.split('.').collect();
        if parts.len() >= 3 && parts.iter().take(3).all(|p| !p.is_empty()) {
            let v_str = format!("{}.{}.{}", parts[0], parts[1], parts[2]);
            if let Ok(v) = Version::parse(&v_str) {
                return Some(v);
            }
        }
    }
    None
}

fn spawn_version(cmd: &str, arg: &str) -> Option<std::process::Output> {
    if let Ok(out) = Command::new(cmd).arg(arg).output() {
        return Some(out);
    }
    // On Windows, pnpm/corepack ship as .cmd shims that CreateProcessW
    // won't auto-resolve from PATHEXT. Fall back to an explicit .cmd lookup.
    if cfg!(windows) {
        if let Ok(out) = Command::new(format!("{cmd}.cmd")).arg(arg).output() {
            return Some(out);
        }
    }
    None
}

fn run_version(cmd: &str, arg: &str) -> Option<Version> {
    let output = spawn_version(cmd, arg)?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    parse_first_semver(&stdout).or_else(|| parse_first_semver(&stderr))
}

fn check(cmd: &str, arg: &str, min: &Version) -> Status {
    match run_version(cmd, arg) {
        Some(v) if v >= *min => Status::Ok(v),
        Some(v) => Status::Outdated {
            found: v,
            min: min.clone(),
        },
        None => Status::Missing,
    }
}

fn tool_exists(cmd: &str) -> bool {
    spawn_version(cmd, "--version")
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn symbol(status: &Status) -> &'static str {
    match status {
        Status::Ok(_) => "\x1b[32m✓\x1b[0m",
        Status::Outdated { .. } => "\x1b[33m⚠\x1b[0m",
        Status::Missing => "\x1b[31m✗\x1b[0m",
    }
}

fn report(name: &str, status: &Status, hint: Option<&str>) {
    match status {
        Status::Ok(v) => println!("  {} {} v{}", symbol(status), name, v),
        Status::Outdated { found, min } => {
            println!(
                "  {} {} v{} \x1b[2m(need ≥ {})\x1b[0m",
                symbol(status),
                name,
                found,
                min
            );
            if let Some(h) = hint {
                println!("    \x1b[2m{}\x1b[0m", h);
            }
        }
        Status::Missing => {
            println!("  {} {} not found", symbol(status), name);
            if let Some(h) = hint {
                println!("    \x1b[2m{}\x1b[0m", h);
            }
        }
    }
}

pub fn run() -> Result<()> {
    cliclack::intro("Check system tools")?;

    let min = min_versions();
    let mut results: Vec<(String, Status, Option<String>)> = Vec::new();

    let node = check("node", "--version", &min.node);
    let node_hint = match &node {
        Status::Missing => {
            Some("Install Node.js 24 LTS: https://nodejs.org/en/download".to_string())
        }
        Status::Outdated { .. } => {
            Some("Upgrade to Node.js 24 LTS or newer: https://nodejs.org/en/download".to_string())
        }
        _ => None,
    };
    results.push(("Node.js".into(), node, node_hint));

    let pnpm = check("pnpm", "--version", &min.pnpm);
    let pnpm_hint = match &pnpm {
        Status::Missing => Some(if tool_exists("corepack") {
            "Enable pnpm via corepack: corepack enable pnpm".into()
        } else {
            "Install pnpm: https://pnpm.io/installation".into()
        }),
        Status::Outdated { .. } => Some("Upgrade pnpm: pnpm self-update".into()),
        _ => None,
    };
    results.push(("pnpm".into(), pnpm, pnpm_hint));

    let uv = check("uv", "--version", &min.uv);
    let uv_hint = match &uv {
        Status::Missing => {
            Some("Install uv: https://docs.astral.sh/uv/getting-started/installation/".into())
        }
        Status::Outdated { .. } => Some("Upgrade uv: uv self update".into()),
        _ => None,
    };
    results.push(("uv".into(), uv, uv_hint));

    let cargo = check("cargo", "--version", &min.cargo);
    let cargo_hint = match &cargo {
        Status::Missing => Some("Install Rust: https://www.rust-lang.org/tools/install".into()),
        Status::Outdated { .. } => Some("Update toolchain: rustup update stable".into()),
        _ => None,
    };
    let cargo_available = !matches!(cargo, Status::Missing);
    results.push(("cargo".into(), cargo, cargo_hint));

    let wp = check("wasm-pack", "--version", &min.wasm_pack);
    let wp_hint = match &wp {
        Status::Missing => Some(if cargo_available {
            "Install wasm-pack: cargo install wasm-pack".into()
        } else {
            "Install wasm-pack: https://wasm-bindgen.github.io/wasm-pack/installer/".into()
        }),
        Status::Outdated { .. } => {
            Some("Upgrade wasm-pack: cargo install wasm-pack --force".into())
        }
        _ => None,
    };
    results.push(("wasm-pack".into(), wp, wp_hint));

    println!();
    for (name, status, hint) in &results {
        report(name, status, hint.as_deref());
    }
    println!();

    let total = results.len();
    let ready = results.iter().filter(|(_, s, _)| s.is_ok()).count();
    let summary = if ready == total {
        format!("All {total} tools ready")
    } else {
        format!("{ready} of {total} tools ready")
    };
    cliclack::outro(summary)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_node_style() {
        assert_eq!(
            parse_first_semver("v24.11.0\n"),
            Some(Version::new(24, 11, 0))
        );
    }

    #[test]
    fn parses_bare_triple() {
        assert_eq!(
            parse_first_semver("10.28.1\n"),
            Some(Version::new(10, 28, 1))
        );
    }

    #[test]
    fn parses_uv_style() {
        assert_eq!(
            parse_first_semver("uv 0.5.14 (abc123 2026-01-10)"),
            Some(Version::new(0, 5, 14))
        );
    }

    #[test]
    fn parses_cargo_style() {
        assert_eq!(
            parse_first_semver("cargo 1.82.0 (f6e737b1e 2024-10-08)"),
            Some(Version::new(1, 82, 0))
        );
    }

    #[test]
    fn parses_wasm_pack_style() {
        assert_eq!(
            parse_first_semver("wasm-pack 0.13.1"),
            Some(Version::new(0, 13, 1))
        );
    }

    #[test]
    fn returns_none_when_no_triple() {
        assert_eq!(parse_first_semver("no version here"), None);
        assert_eq!(parse_first_semver("only 1.2 not enough"), None);
    }

    #[test]
    fn lts_threshold_matches() {
        let min = Version::new(24, 0, 0);
        assert!(Version::new(24, 0, 0) >= min);
        assert!(Version::new(24, 11, 0) >= min);
        assert!(Version::new(25, 0, 0) >= min);
        assert!(Version::new(20, 10, 0) < min);
        assert!(Version::new(18, 0, 0) < min);
    }

    #[test]
    fn status_is_ok() {
        assert!(Status::Ok(Version::new(1, 0, 0)).is_ok());
        assert!(!Status::Missing.is_ok());
        assert!(!Status::Outdated {
            found: Version::new(1, 0, 0),
            min: Version::new(2, 0, 0),
        }
        .is_ok());
    }
}

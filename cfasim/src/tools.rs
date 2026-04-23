use anyhow::Result;
use semver::Version;
use std::io::IsTerminal;
use std::path::Path;
use std::process::Command;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

const UPDATE_CHECK_TIMEOUT: Duration = Duration::from_secs(5);

struct MinVersion {
    node: Version,
    pnpm: Version,
    cargo: Version,
    wasm_pack: Version,
}

// Committed copies of workspace-root files so minimums stay in sync with:
//   .node-version  → node
//   package.json   → pnpm (via packageManager field)
//   Cargo.toml     → cargo     (via [workspace.package].rust-version)
//                    wasm-pack (via [workspace.metadata.cfasim].wasm-pack-min)
// Kept inside the crate so `cargo publish` tarballs are self-contained.
// A drift-check test below asserts these stay byte-identical to the originals.
// uv uses `uv self update --dry-run` instead of a pinned minimum.
const NODE_VERSION_FILE: &str = include_str!("../embedded/node-version");
const PACKAGE_JSON: &str = include_str!("../embedded/package.json");
const WORKSPACE_CARGO_TOML: &str = include_str!("../embedded/workspace-Cargo.toml");

fn parse_node_min(raw: &str) -> Option<Version> {
    let trimmed = raw.trim().trim_start_matches('v');
    if let Some(v) = parse_first_semver(trimmed) {
        return Some(v);
    }
    trimmed.parse::<u64>().ok().map(|m| Version::new(m, 0, 0))
}

fn parse_pnpm_min(package_json: &str) -> Option<Version> {
    // packageManager pins the exact corepack-managed version. We only use
    // its major as the floor — users with any compatible 10.x should pass.
    let idx = package_json.find("pnpm@")?;
    let v = parse_first_semver(&package_json[idx + 5..])?;
    Some(Version::new(v.major, 0, 0))
}

fn parse_toml_version_field(source: &str, key: &str) -> Option<Version> {
    let needle = format!("{key} = \"");
    let idx = source.find(&needle)?;
    let after = &source[idx + needle.len()..];
    let end = after.find('"')?;
    let value = &after[..end];
    let parts: Vec<&str> = value.split('.').collect();
    match parts.len() {
        2 => Version::parse(&format!("{}.{}.0", parts[0], parts[1])).ok(),
        3 => Version::parse(value).ok(),
        _ => None,
    }
}

fn min_versions() -> MinVersion {
    MinVersion {
        node: parse_node_min(NODE_VERSION_FILE)
            .expect("failed to parse .node-version at build time"),
        pnpm: parse_pnpm_min(PACKAGE_JSON)
            .expect("failed to parse packageManager from package.json"),
        cargo: parse_toml_version_field(WORKSPACE_CARGO_TOML, "rust-version")
            .expect("failed to parse rust-version from workspace Cargo.toml"),
        wasm_pack: parse_toml_version_field(WORKSPACE_CARGO_TOML, "wasm-pack-min")
            .expect("failed to parse wasm-pack-min from workspace Cargo.toml"),
    }
}

#[derive(Debug)]
enum Status {
    Ok(Version),
    Outdated { found: Version, min: Version },
    UpdateAvailable { found: Version, latest: Version },
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
        Status::Outdated { .. } | Status::UpdateAvailable { .. } => "\x1b[33m⚠\x1b[0m",
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
        Status::UpdateAvailable { found, latest } => {
            println!(
                "  {} {} v{} \x1b[2m(update available: v{})\x1b[0m",
                symbol(status),
                name,
                found,
                latest
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

fn current_cfasim_version() -> Version {
    Version::parse(env!("CARGO_PKG_VERSION")).expect("CARGO_PKG_VERSION is always a valid semver")
}

fn check_cfasim() -> Status {
    let current = current_cfasim_version();
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = tx.send(crate::update_check::fetch_latest_version());
    });
    let Ok(Some(latest_str)) = rx.recv_timeout(UPDATE_CHECK_TIMEOUT) else {
        return Status::Ok(current);
    };
    let Ok(latest) = Version::parse(&latest_str) else {
        return Status::Ok(current);
    };
    if latest > current {
        Status::UpdateAvailable {
            found: current,
            latest,
        }
    } else {
        Status::Ok(current)
    }
}

fn check_uv_offline() -> Status {
    match run_version("uv", "--version") {
        Some(v) => Status::Ok(v),
        None => Status::Missing,
    }
}

fn check_uv() -> Status {
    let Some(current) = run_version("uv", "--version") else {
        return Status::Missing;
    };
    // uv self update --dry-run hits the network. Run it in a thread with a
    // short timeout so a slow or offline network doesn't stall the diagnostic.
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let result = Command::new("uv")
            .args(["self", "update", "--dry-run"])
            .output();
        let _ = tx.send(result);
    });
    let Ok(Ok(output)) = rx.recv_timeout(UPDATE_CHECK_TIMEOUT) else {
        return Status::Ok(current);
    };
    if !output.status.success() {
        return Status::Ok(current);
    }
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    // "Would update uv from vX to vY" indicates an update is available.
    // "already on ... latest version" means up to date.
    if let Some(idx) = text.find("Would update") {
        if let Some(latest) = parse_uv_target_version(&text[idx..], &current) {
            return Status::UpdateAvailable {
                found: current,
                latest,
            };
        }
    }
    Status::Ok(current)
}

fn parse_uv_target_version(line: &str, current: &Version) -> Option<Version> {
    // "Would update uv from v0.11.7 to v0.12.0" — take the second semver.
    let idx = line.find(" to ")?;
    let after = &line[idx + 4..];
    let v = parse_first_semver(after)?;
    if v != *current {
        Some(v)
    } else {
        None
    }
}

pub fn run(skip_network: bool) -> Result<()> {
    run_inner(skip_network, true)
}

/// Tool diagnostic without the "install deps in detected project" prompt —
/// used by `cfasim init`, which already scaffolds and prints its own next steps.
pub fn run_checks_only(skip_network: bool) -> Result<()> {
    run_inner(skip_network, false)
}

fn run_inner(skip_network: bool, offer_setup: bool) -> Result<()> {
    cliclack::intro("Check system tools")?;

    let min = min_versions();
    let mut results: Vec<(String, Status, Option<String>)> = Vec::new();

    let cfasim = if skip_network {
        Status::Ok(current_cfasim_version())
    } else {
        check_cfasim()
    };
    let cfasim_hint = match &cfasim {
        Status::UpdateAvailable { .. } => Some("Upgrade cfasim: cfasim update".into()),
        _ => None,
    };
    results.push(("cfasim".into(), cfasim, cfasim_hint));

    let node = check("node", "--version", &min.node);
    let node_hint = match &node {
        Status::Missing => Some(format!(
            "Install Node.js {}+: https://nodejs.org/en/download",
            min.node.major
        )),
        Status::Outdated { .. } => Some(format!(
            "Upgrade Node.js to {}+: https://nodejs.org/en/download",
            min.node.major
        )),
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

    let uv = if skip_network {
        check_uv_offline()
    } else {
        check_uv()
    };
    let uv_hint = match &uv {
        Status::Missing => {
            Some("Install uv: https://docs.astral.sh/uv/getting-started/installation/".into())
        }
        Status::UpdateAvailable { .. } => Some("Upgrade uv: uv self update".into()),
        _ => None,
    };
    results.push(("uv \x1b[2m(python projects)\x1b[0m".into(), uv, uv_hint));

    let cargo = check("cargo", "--version", &min.cargo);
    let cargo_hint = match &cargo {
        Status::Missing => Some("Install Rust: https://www.rust-lang.org/tools/install".into()),
        Status::Outdated { .. } => Some("Update toolchain: rustup update stable".into()),
        _ => None,
    };
    let cargo_available = !matches!(cargo, Status::Missing);
    results.push((
        "cargo \x1b[2m(rust projects)\x1b[0m".into(),
        cargo,
        cargo_hint,
    ));

    let wp = check("wasm-pack", "--version", &min.wasm_pack);
    let wp_hint = match &wp {
        Status::Missing => Some(if cargo_available {
            "Install wasm-pack: cargo install wasm-pack --locked".into()
        } else {
            "Install wasm-pack: https://wasm-bindgen.github.io/wasm-pack/installer/".into()
        }),
        Status::Outdated { .. } => Some(if cargo_available {
            "Upgrade wasm-pack: cargo install wasm-pack --locked --force".into()
        } else {
            "Upgrade wasm-pack: https://wasm-bindgen.github.io/wasm-pack/installer/".into()
        }),
        _ => None,
    };
    results.push((
        "wasm-pack \x1b[2m(rust projects)\x1b[0m".into(),
        wp,
        wp_hint,
    ));

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

    if offer_setup {
        offer_project_setup();
    }
    Ok(())
}

fn has_dep(package_json: &serde_json::Value, name: &str) -> bool {
    for key in ["dependencies", "devDependencies", "peerDependencies"] {
        if let Some(deps) = package_json.get(key).and_then(|v| v.as_object()) {
            if deps.contains_key(name) {
                return true;
            }
        }
    }
    false
}

fn is_cfasim_project_with_playwright(dir: &Path) -> bool {
    let Ok(text) = std::fs::read_to_string(dir.join("package.json")) else {
        return false;
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) else {
        return false;
    };
    if !has_dep(&value, "cfasim-ui") {
        return false;
    }
    [
        "playwright.config.ts",
        "playwright.config.js",
        "playwright.config.mjs",
        "playwright.config.cjs",
    ]
    .iter()
    .any(|f| dir.join(f).is_file())
}

// Mirrors the Windows .cmd fallback in spawn_version — corepack-managed pnpm
// ships as a .cmd shim that CreateProcessW won't auto-resolve from PATHEXT.
fn run_pnpm(args: &[&str], cwd: &Path) -> bool {
    if let Ok(s) = Command::new("pnpm").args(args).current_dir(cwd).status() {
        return s.success();
    }
    if cfg!(windows) {
        if let Ok(s) = Command::new("pnpm.cmd")
            .args(args)
            .current_dir(cwd)
            .status()
        {
            return s.success();
        }
    }
    false
}

fn offer_project_setup() {
    let Ok(cwd) = std::env::current_dir() else {
        return;
    };
    if !is_cfasim_project_with_playwright(&cwd) {
        return;
    }
    if !std::io::stdin().is_terminal() {
        return;
    }
    if !tool_exists("pnpm") {
        return;
    }

    println!("\n\x1b[1mDetected cfasim project with Playwright.\x1b[0m");
    println!("Running \x1b[36mpnpm install\x1b[0m...\n");

    if !run_pnpm(&["install"], &cwd) {
        eprintln!("\n\x1b[33mpnpm install failed — skipping browser install\x1b[0m");
        return;
    }
    println!();

    let install_browsers =
        cliclack::confirm("Install Playwright browsers (chromium) for e2e testing?")
            .initial_value(true)
            .interact()
            .unwrap_or(false);

    if !install_browsers {
        return;
    }
    println!();
    if !run_pnpm(&["exec", "playwright", "install", "chromium"], &cwd) {
        eprintln!(
            "\n\x1b[33mPlaywright install failed — try: pnpm exec playwright install chromium\x1b[0m"
        );
    }
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
    fn parses_node_version_bare_major() {
        assert_eq!(parse_node_min("24\n"), Some(Version::new(24, 0, 0)));
    }

    #[test]
    fn parses_node_version_with_v_prefix() {
        assert_eq!(parse_node_min("v24.11.0\n"), Some(Version::new(24, 11, 0)));
    }

    #[test]
    fn parses_pnpm_floor_to_major() {
        let pj = r#"{"packageManager": "pnpm@10.28.1", "other": "x"}"#;
        assert_eq!(parse_pnpm_min(pj), Some(Version::new(10, 0, 0)));
    }

    #[test]
    fn parses_toml_version_field_two_parts() {
        let toml = "[workspace.package]\nrust-version = \"1.80\"\n";
        assert_eq!(
            parse_toml_version_field(toml, "rust-version"),
            Some(Version::new(1, 80, 0))
        );
    }

    #[test]
    fn parses_toml_version_field_three_parts() {
        let toml = "rust-version = \"1.82.1\"\n";
        assert_eq!(
            parse_toml_version_field(toml, "rust-version"),
            Some(Version::new(1, 82, 1))
        );
    }

    #[test]
    fn parses_toml_custom_field() {
        let toml = "[workspace.metadata.cfasim]\nwasm-pack-min = \"0.13\"\n";
        assert_eq!(
            parse_toml_version_field(toml, "wasm-pack-min"),
            Some(Version::new(0, 13, 0))
        );
    }

    #[test]
    fn embedded_files_parse_at_runtime() {
        assert!(parse_node_min(NODE_VERSION_FILE).is_some());
        assert!(parse_pnpm_min(PACKAGE_JSON).is_some());
        assert!(parse_toml_version_field(WORKSPACE_CARGO_TOML, "rust-version").is_some());
        assert!(parse_toml_version_field(WORKSPACE_CARGO_TOML, "wasm-pack-min").is_some());
    }

    // Published tarballs don't contain the workspace originals, so the check
    // only runs when invoked from a workspace checkout. Inside the workspace
    // (including CI), drift fails the build.
    #[test]
    fn embedded_files_match_workspace_sources() {
        let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        let workspace = manifest.parent().expect("cfasim has a parent dir");
        for (source_name, embedded_name, embedded) in [
            (".node-version", "node-version", NODE_VERSION_FILE),
            ("package.json", "package.json", PACKAGE_JSON),
            ("Cargo.toml", "workspace-Cargo.toml", WORKSPACE_CARGO_TOML),
        ] {
            let source_path = workspace.join(source_name);
            let Ok(source) = std::fs::read_to_string(&source_path) else {
                continue;
            };
            assert_eq!(
                source, embedded,
                "cfasim/embedded/{embedded_name} drifted from workspace {source_name} — \
                 refresh the copies in cfasim/embedded/ (also done automatically by \
                 scripts/version.mjs on `plz version`)"
            );
        }
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
        assert!(!Status::UpdateAvailable {
            found: Version::new(1, 0, 0),
            latest: Version::new(2, 0, 0),
        }
        .is_ok());
    }

    #[test]
    fn parses_uv_target_from_dry_run() {
        let text = "Would update uv from v0.11.7 to v0.12.0\n";
        let current = Version::new(0, 11, 7);
        assert_eq!(
            parse_uv_target_version(text, &current),
            Some(Version::new(0, 12, 0))
        );
    }

    #[test]
    fn ignores_same_version_dry_run() {
        let text = "Would update uv from v0.11.7 to v0.11.7\n";
        let current = Version::new(0, 11, 7);
        assert_eq!(parse_uv_target_version(text, &current), None);
    }

    #[test]
    fn detects_cfasim_project_with_playwright() {
        let dir = tempfile::TempDir::new().unwrap();
        std::fs::write(
            dir.path().join("package.json"),
            r#"{"dependencies":{"vue":"^3","cfasim-ui":"^0.3.0"},"devDependencies":{"@playwright/test":"^1"}}"#,
        )
        .unwrap();
        std::fs::write(dir.path().join("playwright.config.ts"), "").unwrap();
        assert!(is_cfasim_project_with_playwright(dir.path()));
    }

    #[test]
    fn detects_cfasim_in_dev_dependencies() {
        let dir = tempfile::TempDir::new().unwrap();
        std::fs::write(
            dir.path().join("package.json"),
            r#"{"devDependencies":{"cfasim-ui":"^0.3.0"}}"#,
        )
        .unwrap();
        std::fs::write(dir.path().join("playwright.config.mjs"), "").unwrap();
        assert!(is_cfasim_project_with_playwright(dir.path()));
    }

    #[test]
    fn skips_when_no_cfasim_ui_dep() {
        let dir = tempfile::TempDir::new().unwrap();
        std::fs::write(
            dir.path().join("package.json"),
            r#"{"dependencies":{"vue":"^3"}}"#,
        )
        .unwrap();
        std::fs::write(dir.path().join("playwright.config.ts"), "").unwrap();
        assert!(!is_cfasim_project_with_playwright(dir.path()));
    }

    #[test]
    fn skips_when_no_playwright_config() {
        let dir = tempfile::TempDir::new().unwrap();
        std::fs::write(
            dir.path().join("package.json"),
            r#"{"dependencies":{"cfasim-ui":"^0.3.0"}}"#,
        )
        .unwrap();
        assert!(!is_cfasim_project_with_playwright(dir.path()));
    }

    #[test]
    fn skips_when_no_package_json() {
        let dir = tempfile::TempDir::new().unwrap();
        std::fs::write(dir.path().join("playwright.config.ts"), "").unwrap();
        assert!(!is_cfasim_project_with_playwright(dir.path()));
    }

    #[test]
    fn skips_when_package_json_invalid() {
        let dir = tempfile::TempDir::new().unwrap();
        std::fs::write(dir.path().join("package.json"), "not json").unwrap();
        std::fs::write(dir.path().join("playwright.config.ts"), "").unwrap();
        assert!(!is_cfasim_project_with_playwright(dir.path()));
    }
}

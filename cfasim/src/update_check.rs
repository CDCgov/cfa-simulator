use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::proc::run_with_timeout;
use crate::settings;

const CHECK_INTERVAL_SECS: u64 = 7 * 24 * 60 * 60; // 7 days
const CHECK_TIMEOUT: Duration = Duration::from_millis(500);

#[derive(Default)]
struct CachedCheck {
    last_check: u64,
    latest_version: Option<String>,
}

fn cache_path() -> Option<std::path::PathBuf> {
    settings::config_dir().map(|d| d.join("update-check"))
}

fn read_cache(path: &std::path::Path) -> CachedCheck {
    let Ok(content) = std::fs::read_to_string(path) else {
        return CachedCheck::default();
    };
    let Ok(doc) = content.parse::<toml_edit::DocumentMut>() else {
        return CachedCheck::default();
    };
    CachedCheck {
        last_check: doc
            .get("last_check")
            .and_then(|v| v.as_integer())
            .unwrap_or(0) as u64,
        latest_version: doc
            .get("latest_version")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    }
}

fn write_cache(path: &std::path::Path, latest_version: &str) {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let content = format!("last_check = {now}\nlatest_version = \"{latest_version}\"\n");
    let _ = std::fs::write(path, content);
}

pub(crate) fn fetch_latest_version() -> Option<String> {
    let mut updater = crate::update::configured_updater();
    let current = env!("CARGO_PKG_VERSION");
    updater.set_current_version(current.parse().ok()?).ok()?;

    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .ok()?;
    let version = runtime.block_on(updater.query_new_version()).ok()??;
    Some(version.to_string())
}

fn print_hint(latest: &str) {
    let current = env!("CARGO_PKG_VERSION");
    if let (Ok(curr), Ok(lat)) = (
        semver::Version::parse(current),
        semver::Version::parse(latest),
    ) {
        if lat > curr {
            eprintln!(
                "\x1b[2mA new version of cfasim is available (v{latest}). Run `cfasim update` to upgrade.\x1b[0m"
            );
        }
    }
}

pub fn maybe_print_update_hint() {
    if std::env::var_os("CFASIM_COMMAND").is_some() {
        return;
    }
    if is_ci::cached() {
        return;
    }
    // uvx runs are ephemeral: uv picks the version and `cfasim update` would
    // target uv's cached binary, so the hint doesn't apply.
    if settings::is_spawned_by_uv() {
        return;
    }

    let s = settings::load();
    if !s.check_for_updates {
        return;
    }

    let Some(path) = cache_path() else { return };
    let cache = read_cache(&path);

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let needs_fetch = now.saturating_sub(cache.last_check) >= CHECK_INTERVAL_SECS;

    if needs_fetch {
        match run_with_timeout(CHECK_TIMEOUT, fetch_latest_version) {
            Some(Some(version)) => {
                write_cache(&path, &version);
                print_hint(&version);
            }
            Some(None) => {
                let current = env!("CARGO_PKG_VERSION");
                write_cache(&path, current);
            }
            None => {
                if let Some(ref v) = cache.latest_version {
                    print_hint(v);
                }
            }
        }
    } else if let Some(ref v) = cache.latest_version {
        print_hint(v);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_cache_missing_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let c = read_cache(&dir.path().join("nonexistent"));
        assert_eq!(c.last_check, 0);
        assert!(c.latest_version.is_none());
    }

    #[test]
    fn read_write_cache_roundtrip() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("update-check");
        write_cache(&path, "1.2.3");
        let c = read_cache(&path);
        assert!(c.last_check > 0);
        assert_eq!(c.latest_version.as_deref(), Some("1.2.3"));
    }

    #[test]
    fn print_hint_no_panic_on_equal_version() {
        let current = env!("CARGO_PKG_VERSION");
        print_hint(current);
    }
}

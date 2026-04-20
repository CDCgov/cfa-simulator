use std::io::IsTerminal;
use std::path::PathBuf;

#[derive(Default)]
pub struct Settings {
    pub check_for_updates: bool,
}

pub fn config_dir() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os("CFASIM_CONFIG_DIR") {
        return Some(PathBuf::from(dir));
    }
    home::home_dir().map(|h| h.join(".cfasim"))
}

fn settings_path() -> Option<PathBuf> {
    config_dir().map(|d| d.join("settings.toml"))
}

pub fn load() -> Settings {
    let Some(path) = settings_path() else {
        return Settings::default();
    };
    let Ok(content) = std::fs::read_to_string(&path) else {
        return Settings::default();
    };
    let Ok(doc) = content.parse::<toml_edit::DocumentMut>() else {
        return Settings::default();
    };
    Settings {
        check_for_updates: doc
            .get("check_for_updates")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
    }
}

fn save(settings: &Settings) -> std::io::Result<()> {
    let Some(path) = settings_path() else {
        return Ok(());
    };
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(
        path,
        format!("check_for_updates = {}\n", settings.check_for_updates),
    )
}

/// True when uv (via `uvx`, `uv run`, or `uv tool run`) spawned this process.
/// Documented: uv sets `UV` to its own binary path in every subprocess it spawns.
fn is_spawned_by_uv() -> bool {
    std::env::var_os("UV").is_some()
}

/// On first run of a permanently-installed cfasim binary, prompt the user to
/// opt into weekly update checks and persist the answer. Skipped silently for
/// ephemeral uvx runs, non-interactive stdin, or when the settings file already
/// exists.
pub fn prompt_for_updates_if_first_run() {
    let Some(path) = settings_path() else { return };
    if path.exists() {
        return;
    }
    if is_spawned_by_uv() {
        return;
    }
    if !std::io::stdin().is_terminal() {
        return;
    }

    let answer = cliclack::confirm("Check for cfasim updates weekly?")
        .initial_value(true)
        .interact()
        .unwrap_or(false);

    let _ = save(&Settings {
        check_for_updates: answer,
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // Serializes tests that mutate the CFASIM_CONFIG_DIR env var; cargo test
    // runs tests in parallel by default and process env is shared state.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn load_missing_returns_default() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let dir = tempfile::TempDir::new().unwrap();
        std::env::set_var("CFASIM_CONFIG_DIR", dir.path());
        let s = load();
        std::env::remove_var("CFASIM_CONFIG_DIR");
        assert!(!s.check_for_updates);
    }

    #[test]
    fn save_and_load_roundtrip() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let dir = tempfile::TempDir::new().unwrap();
        std::env::set_var("CFASIM_CONFIG_DIR", dir.path());
        let save_result = save(&Settings {
            check_for_updates: true,
        });
        let s = load();
        std::env::remove_var("CFASIM_CONFIG_DIR");
        save_result.unwrap();
        assert!(s.check_for_updates);
    }
}

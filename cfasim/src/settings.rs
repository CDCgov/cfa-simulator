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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_missing_returns_default() {
        let dir = tempfile::TempDir::new().unwrap();
        std::env::set_var("CFASIM_CONFIG_DIR", dir.path());
        let s = load();
        assert!(!s.check_for_updates);
        std::env::remove_var("CFASIM_CONFIG_DIR");
    }
}

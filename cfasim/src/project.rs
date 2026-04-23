use std::path::Path;

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Kind {
    Python,
    Rust,
}

pub struct Project {
    pub kind: Kind,
    pub has_playwright: bool,
}

/// Detect a cfasim project rooted at `dir`. Returns `None` if `dir` isn't a
/// cfasim project (no `package.json` with a `cfasim-ui` dep) or doesn't match
/// either of the python/rust template shapes.
pub fn detect(dir: &Path) -> Option<Project> {
    let text = std::fs::read_to_string(dir.join("package.json")).ok()?;
    let value: serde_json::Value = serde_json::from_str(&text).ok()?;
    if !has_dep(&value, "cfasim-ui") {
        return None;
    }
    let kind = if dir.join("pyproject.toml").is_file() {
        Kind::Python
    } else if dir.join("Cargo.toml").is_file() {
        Kind::Rust
    } else {
        return None;
    };
    let has_playwright = [
        "playwright.config.ts",
        "playwright.config.js",
        "playwright.config.mjs",
        "playwright.config.cjs",
    ]
    .iter()
    .any(|f| dir.join(f).is_file());
    Some(Project {
        kind,
        has_playwright,
    })
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

#[cfg(test)]
mod tests {
    use super::*;

    fn write(dir: &Path, name: &str, content: &str) {
        std::fs::write(dir.join(name), content).unwrap();
    }

    #[test]
    fn detects_python_template() {
        let dir = tempfile::TempDir::new().unwrap();
        write(
            dir.path(),
            "package.json",
            r#"{"dependencies":{"cfasim-ui":"^0.3.0"}}"#,
        );
        write(dir.path(), "pyproject.toml", "[project]\nname = 'x'\n");
        write(dir.path(), "playwright.config.ts", "");
        let p = detect(dir.path()).unwrap();
        assert_eq!(p.kind, Kind::Python);
        assert!(p.has_playwright);
    }

    #[test]
    fn detects_rust_template() {
        let dir = tempfile::TempDir::new().unwrap();
        write(
            dir.path(),
            "package.json",
            r#"{"dependencies":{"cfasim-ui":"^0.3.0"}}"#,
        );
        write(dir.path(), "Cargo.toml", "[package]\nname = \"x\"\n");
        let p = detect(dir.path()).unwrap();
        assert_eq!(p.kind, Kind::Rust);
        assert!(!p.has_playwright);
    }

    #[test]
    fn python_wins_when_both_manifests_exist() {
        let dir = tempfile::TempDir::new().unwrap();
        write(
            dir.path(),
            "package.json",
            r#"{"devDependencies":{"cfasim-ui":"^0.3.0"}}"#,
        );
        write(dir.path(), "pyproject.toml", "");
        write(dir.path(), "Cargo.toml", "");
        let p = detect(dir.path()).unwrap();
        assert_eq!(p.kind, Kind::Python);
    }

    #[test]
    fn none_without_cfasim_ui() {
        let dir = tempfile::TempDir::new().unwrap();
        write(
            dir.path(),
            "package.json",
            r#"{"dependencies":{"vue":"^3"}}"#,
        );
        write(dir.path(), "pyproject.toml", "");
        assert!(detect(dir.path()).is_none());
    }

    #[test]
    fn none_without_manifest() {
        let dir = tempfile::TempDir::new().unwrap();
        write(
            dir.path(),
            "package.json",
            r#"{"dependencies":{"cfasim-ui":"^0.3.0"}}"#,
        );
        assert!(detect(dir.path()).is_none());
    }

    #[test]
    fn none_without_package_json() {
        let dir = tempfile::TempDir::new().unwrap();
        write(dir.path(), "pyproject.toml", "");
        assert!(detect(dir.path()).is_none());
    }
}

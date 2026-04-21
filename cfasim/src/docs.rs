use anyhow::{anyhow, Result};
use serde::Deserialize;
use std::io::IsTerminal;
use std::path::{Path, PathBuf};

const DOCS_PACKAGE_SUBPATH: &str = "@cfasim-ui/docs";
const INDEX_FILE: &str = "index.json";
const DOCS_URL: &str = "https://cdcgov.github.io/cfa-simulator/docs/";

#[derive(Deserialize)]
struct Index {
    content: Content,
}

#[derive(Deserialize)]
struct Content {
    components: Vec<Entry>,
    charts: Vec<Entry>,
}

#[derive(Deserialize)]
struct Entry {
    name: String,
    slug: String,
}

pub fn run(json: bool) -> Result<()> {
    let start = std::env::current_dir()?;
    let package_root = find_docs_package(&start).ok_or_else(|| {
        anyhow!(
            "Could not find node_modules/{DOCS_PACKAGE_SUBPATH} in {} or any parent.\n\
             Install it in your project: `pnpm add -D @cfasim-ui/docs`",
            start.display()
        )
    })?;
    let index_path = package_root.join(INDEX_FILE);
    let raw = std::fs::read_to_string(&index_path)
        .map_err(|e| anyhow!("Failed to read {}: {e}", index_path.display()))?;

    if json {
        let absolutized = absolutize_paths(&raw, &package_root)
            .map_err(|e| anyhow!("Failed to parse {}: {e}", index_path.display()))?;
        println!("{absolutized}");
        return Ok(());
    }

    let index: Index = serde_json::from_str(&raw)
        .map_err(|e| anyhow!("Failed to parse {}: {e}", index_path.display()))?;
    print_directory(&index);
    Ok(())
}

fn absolutize_paths(raw: &str, package_root: &Path) -> serde_json::Result<String> {
    let mut value: serde_json::Value = serde_json::from_str(raw)?;
    for category in ["components", "charts"] {
        let Some(entries) = value
            .pointer_mut(&format!("/content/{category}"))
            .and_then(|v| v.as_array_mut())
        else {
            continue;
        };
        for entry in entries {
            for field in ["docs", "source"] {
                let Some(rel) = entry.get(field).and_then(|v| v.as_str()) else {
                    continue;
                };
                let abs = package_root.join(rel);
                entry[field] = serde_json::Value::String(abs.to_string_lossy().into_owned());
            }
        }
    }
    serde_json::to_string_pretty(&value)
}

fn print_directory(index: &Index) {
    let style = Style::detect();
    println!("Run `cfasim docs --json` for a machine-readable directory with file paths.");
    println!();
    println!("Full docs: {DOCS_URL}");
    println!();
    print_section(
        &style,
        "Components",
        "components",
        &index.content.components,
    );
    println!();
    print_section(&style, "Charts", "charts", &index.content.charts);
}

fn print_section(style: &Style, title: &str, category: &str, entries: &[Entry]) {
    println!("{}:", style.heading(title));
    for entry in entries {
        let url = format!("{DOCS_URL}cfasim-ui/{category}/{}", entry.slug);
        println!("  {}  {}", style.name(&entry.name), style.dim(&url));
    }
}

struct Style {
    enabled: bool,
}

impl Style {
    fn detect() -> Self {
        Self {
            enabled: std::io::stdout().is_terminal(),
        }
    }

    fn heading(&self, s: &str) -> String {
        self.wrap(s, "\x1b[1m")
    }

    fn name(&self, s: &str) -> String {
        self.wrap(s, "\x1b[1;36m")
    }

    fn dim(&self, s: &str) -> String {
        self.wrap(s, "\x1b[2m")
    }

    fn wrap(&self, s: &str, prefix: &str) -> String {
        if self.enabled {
            format!("{prefix}{s}\x1b[0m")
        } else {
            s.to_string()
        }
    }
}

fn find_docs_package(start: &Path) -> Option<PathBuf> {
    let mut cur = Some(start);
    while let Some(dir) = cur {
        let candidate = dir.join("node_modules").join(DOCS_PACKAGE_SUBPATH);
        if candidate.join("package.json").exists() {
            return Some(candidate);
        }
        cur = dir.parent();
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn finds_docs_package_in_cwd() {
        let tmp = tempdir().unwrap();
        let pkg = tmp
            .path()
            .join("node_modules")
            .join("@cfasim-ui")
            .join("docs");
        fs::create_dir_all(&pkg).unwrap();
        fs::write(pkg.join("package.json"), "{}").unwrap();

        let found = find_docs_package(tmp.path()).unwrap();
        assert_eq!(found, pkg);
    }

    #[test]
    fn walks_up_to_find_docs_package() {
        let tmp = tempdir().unwrap();
        let pkg = tmp
            .path()
            .join("node_modules")
            .join("@cfasim-ui")
            .join("docs");
        fs::create_dir_all(&pkg).unwrap();
        fs::write(pkg.join("package.json"), "{}").unwrap();

        let nested = tmp.path().join("a").join("b").join("c");
        fs::create_dir_all(&nested).unwrap();

        let found = find_docs_package(&nested).unwrap();
        assert_eq!(found, pkg);
    }

    #[test]
    fn returns_none_when_not_installed() {
        let tmp = tempdir().unwrap();
        assert!(find_docs_package(tmp.path()).is_none());
    }

    #[test]
    fn absolutize_rewrites_docs_and_source_only() {
        let raw = r#"{
            "version": "0.0.0",
            "content": {
                "components": [
                    {"name": "Button", "slug": "button", "docs": "components/Button.md", "source": "components/Button.vue", "keywords": ["button"]}
                ],
                "charts": [
                    {"name": "LineChart", "slug": "line-chart", "docs": "charts/LineChart.md", "source": "charts/LineChart.vue", "keywords": []}
                ]
            }
        }"#;
        let root = PathBuf::from("/fake/node_modules/@cfasim-ui/docs");
        let out = absolutize_paths(raw, &root).unwrap();
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(
            v["content"]["components"][0]["docs"],
            "/fake/node_modules/@cfasim-ui/docs/components/Button.md"
        );
        assert_eq!(
            v["content"]["components"][0]["source"],
            "/fake/node_modules/@cfasim-ui/docs/components/Button.vue"
        );
        assert_eq!(v["content"]["components"][0]["name"], "Button");
        assert_eq!(v["content"]["components"][0]["slug"], "button");
        assert_eq!(v["content"]["components"][0]["keywords"][0], "button");
        assert_eq!(
            v["content"]["charts"][0]["docs"],
            "/fake/node_modules/@cfasim-ui/docs/charts/LineChart.md"
        );
    }
}

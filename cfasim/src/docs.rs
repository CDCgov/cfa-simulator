use anyhow::{anyhow, Result};
use serde::Deserialize;
use std::io::IsTerminal;
use std::path::{Path, PathBuf};

/// Packages that ship bundled docs (docs/index.json + built .md per component).
const UI_PACKAGES: [&str; 2] = ["@cfasim-ui/components", "@cfasim-ui/charts"];
/// The umbrella package scaffolded projects depend on. Its @cfasim-ui/*
/// dependencies live in pnpm's virtual store, not the root node_modules.
const UMBRELLA_PACKAGE: &str = "cfasim-ui";
const PACKAGE_INDEX: &str = "docs/index.json";
/// Pre-0.8 projects shipped docs in a separate @cfasim-ui/docs package.
const LEGACY_PACKAGE: &str = "@cfasim-ui/docs";
const LEGACY_INDEX: &str = "index.json";
const DOCS_URL: &str = "https://cdcgov.github.io/cfa-simulator/docs/";

#[derive(Deserialize)]
struct Index {
    content: Content,
}

#[derive(Deserialize)]
struct Content {
    #[serde(default)]
    components: Vec<Entry>,
    #[serde(default)]
    charts: Vec<Entry>,
}

#[derive(Deserialize)]
struct Entry {
    name: String,
    slug: String,
}

struct DocsPackage {
    root: PathBuf,
    index: PathBuf,
}

pub fn run(json: bool) -> Result<()> {
    let start = std::env::current_dir()?;
    let packages = find_docs_packages(&start).ok_or_else(|| {
        anyhow!(
            "Could not find bundled docs ({}) under node_modules in {} or any parent.\n\
             Install cfasim-ui in your project: `pnpm add cfasim-ui`",
            UI_PACKAGES.join(" or "),
            start.display()
        )
    })?;
    let merged = merge_indexes(&packages)?;

    if json {
        println!("{}", serde_json::to_string_pretty(&merged)?);
        return Ok(());
    }

    let index: Index = serde_json::from_value(merged)?;
    print_directory(&index);
    Ok(())
}

/// Merge each package's index into one `{version, content: {components, charts}}`
/// value, rewriting the relative `docs`/`source` fields into absolute paths.
fn merge_indexes(packages: &[DocsPackage]) -> Result<serde_json::Value> {
    let mut merged = serde_json::json!({
        "content": { "components": [], "charts": [] }
    });
    for pkg in packages {
        let raw = std::fs::read_to_string(&pkg.index)
            .map_err(|e| anyhow!("Failed to read {}: {e}", pkg.index.display()))?;
        let value: serde_json::Value = serde_json::from_str(&raw)
            .map_err(|e| anyhow!("Failed to parse {}: {e}", pkg.index.display()))?;

        if merged.get("version").is_none() {
            if let Some(version) = value.get("version") {
                merged["version"] = version.clone();
            }
        }

        for category in ["components", "charts"] {
            let Some(entries) = value
                .pointer(&format!("/content/{category}"))
                .and_then(|v| v.as_array())
            else {
                continue;
            };
            for entry in entries {
                let mut entry = entry.clone();
                for field in ["docs", "source"] {
                    if let Some(rel) = entry.get(field).and_then(|v| v.as_str()) {
                        let abs = pkg.root.join(rel);
                        entry[field] =
                            serde_json::Value::String(abs.to_string_lossy().into_owned());
                    }
                }
                merged["content"][category]
                    .as_array_mut()
                    .expect("content arrays initialized above")
                    .push(entry);
            }
        }
    }
    Ok(merged)
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

/// Walk up from `start` looking for installed @cfasim-ui packages with bundled
/// docs. Falls back to the legacy @cfasim-ui/docs package at the same level so
/// the CLI keeps working in projects scaffolded before the docs moved.
fn find_docs_packages(start: &Path) -> Option<Vec<DocsPackage>> {
    for dir in start.ancestors() {
        let bases = search_bases(&dir.join("node_modules"));

        let found: Vec<DocsPackage> = UI_PACKAGES
            .iter()
            .filter_map(|pkg| {
                bases
                    .iter()
                    .find_map(|base| docs_package_at(base, pkg, PACKAGE_INDEX))
            })
            .collect();
        if !found.is_empty() {
            return Some(found);
        }

        if let Some(legacy) = bases
            .iter()
            .find_map(|base| docs_package_at(base, LEGACY_PACKAGE, LEGACY_INDEX))
        {
            return Some(vec![legacy]);
        }
    }
    None
}

fn docs_package_at(base: &Path, package: &str, index_rel: &str) -> Option<DocsPackage> {
    let root = base.join(package);
    let index = root.join(index_rel);
    index.exists().then_some(DocsPackage { root, index })
}

/// Directories to search for @cfasim-ui packages: the node_modules itself
/// (direct dependencies), plus the umbrella package's node_modules in pnpm's
/// virtual store (realpath of node_modules/cfasim-ui, then its parent), where
/// its @cfasim-ui/* dependencies are linked as siblings. Scaffolded projects
/// only depend on the umbrella, so the packages never appear at the root.
fn search_bases(node_modules: &Path) -> Vec<PathBuf> {
    let mut bases = vec![node_modules.to_path_buf()];
    if let Ok(real) = std::fs::canonicalize(node_modules.join(UMBRELLA_PACKAGE)) {
        if let Some(parent) = real.parent() {
            bases.push(parent.to_path_buf());
        }
    }
    bases
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn write_index(pkg_root: &Path, index_subpath: &str, content: &str) {
        let index = pkg_root.join(index_subpath);
        fs::create_dir_all(index.parent().unwrap()).unwrap();
        fs::write(index, content).unwrap();
    }

    #[test]
    fn finds_bundled_docs_in_cwd() {
        let tmp = tempdir().unwrap();
        let nm = tmp.path().join("node_modules").join("@cfasim-ui");
        write_index(&nm.join("components"), PACKAGE_INDEX, "{}");
        write_index(&nm.join("charts"), PACKAGE_INDEX, "{}");

        let found = find_docs_packages(tmp.path()).unwrap();
        let roots: Vec<_> = found.iter().map(|p| p.root.clone()).collect();
        assert_eq!(roots, vec![nm.join("components"), nm.join("charts")]);
    }

    #[test]
    fn finds_single_package_when_only_one_installed() {
        let tmp = tempdir().unwrap();
        let nm = tmp.path().join("node_modules").join("@cfasim-ui");
        write_index(&nm.join("charts"), PACKAGE_INDEX, "{}");

        let found = find_docs_packages(tmp.path()).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].root, nm.join("charts"));
    }

    #[test]
    fn walks_up_to_find_bundled_docs() {
        let tmp = tempdir().unwrap();
        let nm = tmp.path().join("node_modules").join("@cfasim-ui");
        write_index(&nm.join("components"), PACKAGE_INDEX, "{}");

        let nested = tmp.path().join("a").join("b").join("c");
        fs::create_dir_all(&nested).unwrap();

        let found = find_docs_packages(&nested).unwrap();
        assert_eq!(found[0].root, nm.join("components"));
    }

    #[test]
    fn falls_back_to_legacy_docs_package() {
        let tmp = tempdir().unwrap();
        let nm = tmp.path().join("node_modules").join("@cfasim-ui");
        // components installed but without bundled docs (pre-0.8 version)
        fs::create_dir_all(nm.join("components")).unwrap();
        write_index(&nm.join("docs"), LEGACY_INDEX, "{}");

        let found = find_docs_packages(tmp.path()).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].root, nm.join("docs"));
        assert_eq!(found[0].index, nm.join("docs").join("index.json"));
    }

    #[test]
    fn prefers_bundled_docs_over_legacy() {
        let tmp = tempdir().unwrap();
        let nm = tmp.path().join("node_modules").join("@cfasim-ui");
        write_index(&nm.join("components"), PACKAGE_INDEX, "{}");
        write_index(&nm.join("docs"), LEGACY_INDEX, "{}");

        let found = find_docs_packages(tmp.path()).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].root, nm.join("components"));
    }

    #[test]
    fn returns_none_when_not_installed() {
        let tmp = tempdir().unwrap();
        assert!(find_docs_packages(tmp.path()).is_none());
    }

    #[test]
    fn merge_absolutizes_and_combines_categories() {
        let tmp = tempdir().unwrap();
        let nm = tmp.path().join("node_modules").join("@cfasim-ui");
        write_index(
            &nm.join("components"),
            PACKAGE_INDEX,
            r#"{
                "version": "1.2.3",
                "package": "@cfasim-ui/components",
                "content": {
                    "components": [
                        {"name": "Button", "slug": "button", "docs": "docs/Button.md", "source": "src/Button/Button.vue", "keywords": ["button"]}
                    ]
                }
            }"#,
        );
        write_index(
            &nm.join("charts"),
            PACKAGE_INDEX,
            r#"{
                "version": "1.2.3",
                "package": "@cfasim-ui/charts",
                "content": {
                    "charts": [
                        {"name": "LineChart", "slug": "line-chart", "docs": "docs/LineChart.md", "source": "src/LineChart/LineChart.vue", "keywords": []}
                    ]
                }
            }"#,
        );

        let packages = find_docs_packages(tmp.path()).unwrap();
        let merged = merge_indexes(&packages).unwrap();

        let components_root = nm.join("components");
        assert_eq!(merged["version"], "1.2.3");
        assert_eq!(
            merged["content"]["components"][0]["docs"],
            components_root.join("docs/Button.md").display().to_string()
        );
        assert_eq!(
            merged["content"]["components"][0]["source"],
            components_root
                .join("src/Button/Button.vue")
                .display()
                .to_string()
        );
        assert_eq!(merged["content"]["components"][0]["name"], "Button");
        assert_eq!(merged["content"]["components"][0]["slug"], "button");
        assert_eq!(merged["content"]["components"][0]["keywords"][0], "button");
        assert_eq!(
            merged["content"]["charts"][0]["docs"],
            nm.join("charts")
                .join("docs/LineChart.md")
                .display()
                .to_string()
        );
    }

    /// Simulate pnpm's isolated layout: node_modules/cfasim-ui is a symlink
    /// into the virtual store, where the umbrella's @cfasim-ui/* dependencies
    /// are siblings rather than entries in the project's root node_modules.
    #[cfg(unix)]
    fn link_umbrella(project: &Path, store_nm: &Path) {
        let nm = project.join("node_modules");
        fs::create_dir_all(&nm).unwrap();
        let target = store_nm.join("cfasim-ui");
        fs::create_dir_all(&target).unwrap();
        std::os::unix::fs::symlink(&target, nm.join("cfasim-ui")).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn finds_bundled_docs_through_umbrella() {
        let tmp = tempdir().unwrap();
        let store_nm = tmp
            .path()
            .join("node_modules/.pnpm/cfasim-ui@0.0.0/node_modules");
        write_index(&store_nm.join("@cfasim-ui/components"), PACKAGE_INDEX, "{}");
        write_index(&store_nm.join("@cfasim-ui/charts"), PACKAGE_INDEX, "{}");
        link_umbrella(tmp.path(), &store_nm);

        let found = find_docs_packages(tmp.path()).unwrap();
        assert_eq!(found.len(), 2);
        assert!(found[0].root.ends_with("@cfasim-ui/components"));
        assert!(found[1].root.ends_with("@cfasim-ui/charts"));
        assert!(found.iter().all(|p| p.index.exists()));
    }

    #[cfg(unix)]
    #[test]
    fn falls_back_to_legacy_through_umbrella() {
        let tmp = tempdir().unwrap();
        let store_nm = tmp
            .path()
            .join("node_modules/.pnpm/cfasim-ui@0.0.0/node_modules");
        write_index(&store_nm.join("@cfasim-ui/docs"), LEGACY_INDEX, "{}");
        link_umbrella(tmp.path(), &store_nm);

        let found = find_docs_packages(tmp.path()).unwrap();
        assert_eq!(found.len(), 1);
        assert!(found[0].root.ends_with("@cfasim-ui/docs"));
    }
}

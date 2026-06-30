use include_dir::{include_dir, Dir};
use minijinja::{context, Environment};
use std::collections::HashMap;
use std::fmt;
use std::fs;
use std::io::Read as IoRead;
use std::path::Path;
use std::process::Command;

const TEMPLATE_URL: &str =
    "https://github.com/cdcgov/cfa-simulator/archive/refs/heads/latest.tar.gz";
const TEMPLATE_PREFIX: &str = "cfa-simulator-latest/cfasim/src/templates/";
const SHARED_DIR: &str = "_shared";

static TEMPLATES: Dir = include_dir!("$CARGO_MANIFEST_DIR/src/templates");

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Template {
    Python,
    Rust,
    Ixa,
    R,
}

impl Template {
    fn dir_name(&self) -> &str {
        match self {
            Template::Python => "python",
            Template::Rust => "rust",
            Template::Ixa => "ixa",
            Template::R => "R",
        }
    }

    fn runtime(&self) -> &str {
        match self {
            Template::Python => "python",
            Template::Rust => "rust",
            Template::Ixa => "ixa",
            Template::R => "R",
        }
    }
}

impl fmt::Display for Template {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Template::Python => write!(f, "Python"),
            Template::Rust => write!(f, "Rust (WASM)"),
            Template::Ixa => write!(f, "Ixa (Rust agent-based model on WASM)"),
            Template::R => write!(f, "R"),
        }
    }
}

/// Files keyed by their path relative to the template root (no leading
/// `python/` or `_shared/`). `_shared/` files are inserted first; template-
/// specific files overlay them, so a file in `python/` with the same relative
/// path wins.
type TemplateFiles = HashMap<String, String>;

fn download_templates(template: &Template) -> Result<TemplateFiles, Box<dyn std::error::Error>> {
    let response = ureq::get(TEMPLATE_URL).call()?;
    let reader = response.into_body().into_reader();
    let decoder = flate2::read::GzDecoder::new(reader);
    let mut archive = tar::Archive::new(decoder);

    let shared_prefix = format!("{}{}/", TEMPLATE_PREFIX, SHARED_DIR);
    let template_prefix = format!("{}{}/", TEMPLATE_PREFIX, template.dir_name());

    let mut shared = TemplateFiles::new();
    let mut specific = TemplateFiles::new();

    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = entry.path()?.to_string_lossy().to_string();
        if !entry.header().entry_type().is_file() {
            continue;
        }

        let (bucket, prefix) = if path.starts_with(&shared_prefix) {
            (&mut shared, &shared_prefix)
        } else if path.starts_with(&template_prefix) {
            (&mut specific, &template_prefix)
        } else {
            continue;
        };

        let relative = path.strip_prefix(prefix).unwrap().to_string();
        eprintln!("  fetched: {}", relative);
        let mut content = String::new();
        entry.read_to_string(&mut content)?;
        bucket.insert(relative, content);
    }

    if specific.is_empty() {
        return Err("No template files found in the downloaded archive".into());
    }

    Ok(merge(shared, specific))
}

fn collect_files(
    dir: &Dir,
    base: &Path,
    out: &mut TemplateFiles,
) -> Result<(), Box<dyn std::error::Error>> {
    for file in dir.files() {
        let relative = file
            .path()
            .strip_prefix(base)
            .unwrap()
            .to_string_lossy()
            .to_string();
        let content = file
            .contents_utf8()
            .ok_or_else(|| format!("Template file is not valid UTF-8: {}", relative))?;
        out.insert(relative, content.to_string());
    }
    for sub in dir.dirs() {
        collect_files(sub, base, out)?;
    }
    Ok(())
}

fn embedded_templates(template: &Template) -> Result<TemplateFiles, Box<dyn std::error::Error>> {
    let mut shared = TemplateFiles::new();
    if let Some(shared_dir) = TEMPLATES.get_dir(SHARED_DIR) {
        collect_files(shared_dir, shared_dir.path(), &mut shared)?;
    }

    let template_subdir = TEMPLATES
        .get_dir(template.dir_name())
        .ok_or_else(|| format!("Embedded template directory not found for {}", template))?;
    let mut specific = TemplateFiles::new();
    collect_files(template_subdir, template_subdir.path(), &mut specific)?;

    if specific.is_empty() {
        return Err("No template files found in embedded directory".into());
    }

    Ok(merge(shared, specific))
}

fn merge(mut shared: TemplateFiles, specific: TemplateFiles) -> TemplateFiles {
    shared.extend(specific);
    shared
}

fn to_module_name(name: &str) -> String {
    name.replace('-', "_")
}

fn to_package_name(name: &str) -> String {
    // R package names must start with a letter, contain only letters, digits,
    // and dots, be at least two characters, and not end in a dot. cfasim
    // project names are looser (leading digits, leading/trailing/repeated
    // separators), so map `-`/`_` to dots and repair the rest.
    let mut out = String::with_capacity(name.len() + 3);
    let mut pending_dot = false;
    for ch in name.chars() {
        if matches!(ch, '-' | '_' | '.') {
            // Defer dots so we never emit a leading, trailing, or doubled one.
            pending_dot = !out.is_empty();
            continue;
        }
        if out.is_empty() && ch.is_ascii_digit() {
            out.push('r'); // Can't start with a digit; seed a leading letter.
        }
        if pending_dot {
            out.push('.');
            pending_dot = false;
        }
        out.push(ch);
    }
    if out.is_empty() {
        out.push('r');
    }
    while out.len() < 2 {
        out.push('x');
    }
    out
}

fn build_env() -> Environment<'static> {
    let mut env = Environment::new();
    // Don't auto-escape — these aren't HTML, they're source files.
    env.set_auto_escape_callback(|_| minijinja::AutoEscape::None);
    // Preserve any final newline in the source file.
    env.set_keep_trailing_newline(true);
    env
}

fn render(
    env: &Environment,
    template: &str,
    name: &str,
    runtime: &str,
) -> Result<String, minijinja::Error> {
    env.render_str(
        template,
        context! {
            project_name => name,
            module_name => to_module_name(name),
            package_name => to_package_name(name),
            cfasim_version => env!("CARGO_PKG_VERSION"),
            runtime => runtime,
            // Set by the e2e tests to the cfa-simulator repo root so the
            // scaffolded project links the local working-tree cfasim-ui
            // packages (via pnpm `overrides`) instead of the published ones.
            // Unset for normal `cfasim init`, so the block is omitted.
            local_ui_dir => std::env::var("CFASIM_LOCAL_UI_DIR").ok(),
        },
    )
}

fn write_file(base: &Path, relative: &str, content: &str) -> std::io::Result<()> {
    let path = base.join(relative);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, content)
}

fn validate_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Name cannot be empty".into());
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("Name must contain only letters, numbers, hyphens, and underscores".into());
    }
    Ok(())
}

fn scaffold(
    project_dir: &Path,
    name: &str,
    template: &Template,
    local: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let templates = if local {
        embedded_templates(template)?
    } else {
        download_templates(template)?
    };

    if project_dir.exists() && project_dir.read_dir()?.next().is_some() {
        return Err(format!(
            "Directory '{}' already exists and is not empty",
            project_dir.display()
        )
        .into());
    }

    let env = build_env();
    let runtime = template.runtime();

    for (relative_path, content) in &templates {
        let output_path = render(&env, relative_path, name, runtime)
            .map_err(|e| format!("rendering path {relative_path}: {e}"))?;
        let rendered = render(&env, content, name, runtime)
            .map_err(|e| format!("rendering {relative_path}: {e}"))?;
        write_file(project_dir, &output_path, &rendered)?;
    }

    Ok(())
}

fn init_git_repo(project_dir: &Path) -> bool {
    if project_dir.join(".git").exists() {
        return false;
    }
    let status = Command::new("git")
        .arg("init")
        .arg("--quiet")
        .current_dir(project_dir)
        .status();
    matches!(status, Ok(s) if s.success())
}

fn resolve_directory(
    directory: &str,
) -> Result<(std::path::PathBuf, String), Box<dyn std::error::Error>> {
    let path = Path::new(directory);
    let abs_path = if path.is_absolute() {
        path.to_path_buf()
    } else if directory == "." {
        std::env::current_dir()?
    } else {
        std::env::current_dir()?.join(path)
    };

    let name = abs_path
        .file_name()
        .ok_or("Cannot derive project name from directory")?
        .to_str()
        .ok_or("Directory name is not valid UTF-8")?
        .to_string();

    validate_name(&name).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;

    Ok((abs_path, name))
}

pub fn run(
    dir: Option<String>,
    template: Option<Template>,
    local: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let interactive = dir.is_none();

    if interactive {
        cliclack::intro("Create a new cfasim project")?;
    }

    let dir = match dir {
        Some(d) => d,
        None => {
            let input: String = cliclack::input("Project directory")
                .placeholder("./my-project")
                .validate(|input: &String| {
                    if input.is_empty() {
                        Err("Directory cannot be empty")
                    } else {
                        Ok(())
                    }
                })
                .interact()?;
            input
        }
    };

    let (project_dir, name) = resolve_directory(&dir)?;

    let template = match template {
        Some(t) => t,
        None => cliclack::select("Template")
            .item(
                Template::Python,
                "Python",
                "Python package built as a wheel for Pyodide",
            )
            .item(
                Template::Rust,
                "Rust",
                "Compiles to WebAssembly via wasm-bindgen",
            )
            .item(
                Template::Ixa,
                "Ixa",
                "Agent-based model using the ixa framework on WASM",
            )
            .item(
                Template::R,
                "R",
                "Bundles R packages for WebAssembly via rwasm",
            )
            .interact()?,
    };

    let spinner_msg = if local {
        "Scaffolding project from local templates..."
    } else {
        "Downloading templates and scaffolding project..."
    };

    let spinner = interactive.then(|| {
        let s = cliclack::spinner();
        s.start(spinner_msg);
        s
    });

    scaffold(&project_dir, &name, &template, local)?;
    let git_initialized = init_git_repo(&project_dir);

    if let Some(spinner) = spinner {
        spinner.stop(if git_initialized {
            "Project created (git repo initialized)"
        } else {
            "Project created"
        });
    } else {
        println!("Created project: {}", name);
        if git_initialized {
            println!("Initialized git repository");
        }
    }

    if interactive {
        println!();
        if let Err(e) = crate::tools::run_checks_only(true) {
            eprintln!("Note: tool check skipped: {e}");
        }
        println!();
    }

    println!("Next steps:\n  cd {dir}\n  pnpm install\n  pnpm run dev");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn is_valid_r_package_name(name: &str) -> bool {
        let bytes = name.as_bytes();
        name.len() >= 2
            && bytes[0].is_ascii_alphabetic()
            && !name.ends_with('.')
            && !name.contains("..")
            && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '.')
    }

    #[test]
    fn package_name_maps_separators_to_dots() {
        assert_eq!(to_package_name("my-model"), "my.model");
        assert_eq!(to_package_name("my_cool-model"), "my.cool.model");
        assert_eq!(to_package_name("model"), "model");
    }

    #[test]
    fn package_name_repairs_invalid_shapes() {
        assert_eq!(to_package_name("2024-sir"), "r2024.sir");
        assert_eq!(to_package_name("model-"), "model");
        assert_eq!(to_package_name("-model"), "model");
        assert_eq!(to_package_name("a--b"), "a.b");
        assert_eq!(to_package_name("a"), "ax");
        assert_eq!(to_package_name("_"), "rx");
    }

    #[test]
    fn package_name_is_always_valid_for_valid_project_names() {
        for name in [
            "my-model",
            "2fast",
            "model-",
            "-model",
            "a--b",
            "a",
            "_",
            "123",
            "ABC",
            "sir_model_2",
        ] {
            let pkg = to_package_name(name);
            assert!(
                is_valid_r_package_name(&pkg),
                "to_package_name({name:?}) = {pkg:?} is not a valid R package name"
            );
        }
    }

    #[test]
    fn module_name_maps_hyphens_to_underscores() {
        assert_eq!(to_module_name("my-model"), "my_model");
        assert_eq!(to_module_name("model"), "model");
    }
}

use include_dir::{include_dir, Dir};
use std::collections::HashMap;
use std::fmt;
use std::fs;
use std::io::Read as IoRead;
use std::path::Path;
use std::process::Command;

const TEMPLATE_URL: &str =
    "https://github.com/cdcgov/cfa-simulator/archive/refs/heads/latest.tar.gz";
const TEMPLATE_PREFIX: &str = "cfa-simulator-latest/cfasim/src/templates/";

static TEMPLATES: Dir = include_dir!("$CARGO_MANIFEST_DIR/src/templates");

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Template {
    Python,
    Rust,
}

impl Template {
    fn prefix(&self) -> &str {
        match self {
            Template::Python => "python/",
            Template::Rust => "rust/",
        }
    }
}

impl fmt::Display for Template {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Template::Python => write!(f, "Python"),
            Template::Rust => write!(f, "Rust (WASM)"),
        }
    }
}

fn download_templates(
    template: &Template,
) -> Result<HashMap<String, String>, Box<dyn std::error::Error>> {
    let response = ureq::get(TEMPLATE_URL).call()?;
    let reader = response.into_body().into_reader();
    let decoder = flate2::read::GzDecoder::new(reader);
    let mut archive = tar::Archive::new(decoder);

    let full_prefix = format!("{}{}", TEMPLATE_PREFIX, template.prefix());
    let mut templates = HashMap::new();

    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = entry.path()?.to_string_lossy().to_string();

        if path.starts_with(&full_prefix) && entry.header().entry_type().is_file() {
            let relative = path.strip_prefix(&full_prefix).unwrap().to_string();
            eprintln!("  fetched: {}", relative);
            let mut content = String::new();
            entry.read_to_string(&mut content)?;
            templates.insert(relative, content);
        }
    }

    if templates.is_empty() {
        return Err("No template files found in the downloaded archive".into());
    }

    Ok(templates)
}

fn collect_files(
    dir: &Dir,
    base: &Path,
    out: &mut HashMap<String, String>,
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

fn embedded_templates(
    template: &Template,
) -> Result<HashMap<String, String>, Box<dyn std::error::Error>> {
    let subdir = TEMPLATES
        .get_dir(template.prefix().trim_end_matches('/'))
        .ok_or_else(|| format!("Embedded template directory not found for {}", template))?;

    let mut templates = HashMap::new();
    collect_files(subdir, subdir.path(), &mut templates)?;

    if templates.is_empty() {
        return Err("No template files found in embedded directory".into());
    }

    Ok(templates)
}

fn to_module_name(name: &str) -> String {
    name.replace('-', "_")
}

fn render(template: &str, name: &str) -> String {
    template
        .replace("%%project_name%%", name)
        .replace("%%module_name%%", &to_module_name(name))
        .replace("%%cfasim_version%%", env!("CARGO_PKG_VERSION"))
}

fn render_path(path: &str, name: &str) -> String {
    path.replace("%%project_name%%", name)
        .replace("%%module_name%%", &to_module_name(name))
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

    for (relative_path, content) in &templates {
        let output_path = render_path(relative_path, name);
        write_file(project_dir, &output_path, &render(content, name))?;
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

    let cd_path = match template {
        Template::Python => format!("{dir}/interactive"),
        Template::Rust => dir.clone(),
    };
    let next_steps = format!(
        "Done! Created {name}.\n\n  Next steps:\n    cd {cd_path}\n    pnpm install\n    pnpm run dev"
    );

    if interactive {
        cliclack::outro(next_steps)?;
    } else {
        println!("{}", next_steps);
    }

    Ok(())
}

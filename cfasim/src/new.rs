use std::collections::HashMap;
use std::fmt;
use std::fs;
use std::io::Read as IoRead;
use std::path::Path;

const TEMPLATE_URL: &str =
    "https://github.com/cdcgov/cfa-simulator/archive/refs/heads/latest.tar.gz";
const TEMPLATE_PREFIX: &str = "cfa-simulator-latest/cfasim/src/templates/";

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ModelType {
    Python,
    Rust,
}

impl fmt::Display for ModelType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ModelType::Python => write!(f, "Python"),
            ModelType::Rust => write!(f, "Rust (WASM)"),
        }
    }
}

fn download_templates() -> Result<HashMap<String, String>, Box<dyn std::error::Error>> {
    let response = ureq::get(TEMPLATE_URL).call()?;
    let reader = response.into_body().into_reader();
    let decoder = flate2::read::GzDecoder::new(reader);
    let mut archive = tar::Archive::new(decoder);

    let mut templates = HashMap::new();

    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = entry.path()?.to_string_lossy().to_string();

        if path.starts_with(TEMPLATE_PREFIX) && entry.header().entry_type().is_file() {
            let relative = path.strip_prefix(TEMPLATE_PREFIX).unwrap().to_string();
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

fn get_template<'a>(
    templates: &'a HashMap<String, String>,
    key: &str,
) -> Result<&'a str, Box<dyn std::error::Error>> {
    templates
        .get(key)
        .map(|s| s.as_str())
        .ok_or_else(|| format!("Template not found: {key}").into())
}

fn to_module_name(name: &str) -> String {
    name.replace('-', "_")
}

fn render(template: &str, name: &str) -> String {
    template
        .replace("%%project_name%%", name)
        .replace("%%module_name%%", &to_module_name(name))
}

fn write_file(base: &Path, relative: &str, content: &str) -> std::io::Result<()> {
    let path = base.join(relative);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, content)
}

fn inject_dependency(package_json: &str, dep_name: &str, version: &str) -> String {
    let marker = "\"@cfasim-ui/theme\"";
    let injection = format!("\"{dep_name}\": \"{version}\",\n    {marker}");
    package_json.replace(marker, &injection)
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

fn scaffold(name: &str, model_type: &ModelType) -> Result<(), Box<dyn std::error::Error>> {
    let templates = download_templates()?;
    let cwd = std::env::current_dir()?;
    let project_dir = cwd.join(name);

    if project_dir.exists() {
        return Err(format!("Directory '{}' already exists", name).into());
    }

    // Write shared files
    let pkg_json = render(get_template(&templates, "package.json")?, name);
    let pkg_json = match model_type {
        ModelType::Python => inject_dependency(&pkg_json, "@cfasim-ui/pyodide", "^0.1.1"),
        ModelType::Rust => inject_dependency(&pkg_json, "@cfasim-ui/wasm", "^0.1.1"),
    };
    write_file(&project_dir, "package.json", &pkg_json)?;
    write_file(
        &project_dir,
        "vite.config.ts",
        &render(get_template(&templates, "vite.config.ts")?, name),
    )?;
    write_file(
        &project_dir,
        "tsconfig.json",
        &render(get_template(&templates, "tsconfig.json")?, name),
    )?;
    write_file(
        &project_dir,
        "index.html",
        &render(get_template(&templates, "index.html")?, name),
    )?;
    write_file(
        &project_dir,
        "src/main.ts",
        &render(get_template(&templates, "src/main.ts")?, name),
    )?;
    write_file(
        &project_dir,
        "src/env.d.ts",
        &render(get_template(&templates, "src/env.d.ts")?, name),
    )?;

    // Write model-specific files
    let module_name = to_module_name(name);
    match model_type {
        ModelType::Python => {
            write_file(
                &project_dir,
                "src/App.vue",
                &render(get_template(&templates, "python/App.vue")?, name),
            )?;
            write_file(
                &project_dir,
                "model/pyproject.toml",
                &render(get_template(&templates, "python/pyproject.toml")?, name),
            )?;
            write_file(
                &project_dir,
                &format!("model/src/{module_name}/__init__.py"),
                &render(get_template(&templates, "python/__init__.py")?, name),
            )?;
        }
        ModelType::Rust => {
            write_file(
                &project_dir,
                "src/App.vue",
                &render(get_template(&templates, "rust/App.vue")?, name),
            )?;
            write_file(
                &project_dir,
                "model/Cargo.toml",
                &render(get_template(&templates, "rust/model/Cargo.toml")?, name),
            )?;
            write_file(
                &project_dir,
                "model/src/lib.rs",
                &render(get_template(&templates, "rust/model/src/lib.rs")?, name),
            )?;
        }
    }

    Ok(())
}

pub fn run(
    name: Option<String>,
    model_type: Option<ModelType>,
) -> Result<(), Box<dyn std::error::Error>> {
    let interactive = name.is_none() || model_type.is_none();

    if interactive {
        cliclack::intro("Create a new cfasim project")?;
    }

    let name = match name {
        Some(n) => {
            validate_name(&n).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            n
        }
        None => cliclack::input("Project name")
            .placeholder("my-simulation")
            .validate(|input: &String| -> Result<(), String> { validate_name(input) })
            .interact()?,
    };

    let model_type = match model_type {
        Some(m) => m,
        None => cliclack::select("Model type")
            .item(
                ModelType::Python,
                "Python",
                "Python package built as a wheel for Pyodide",
            )
            .item(
                ModelType::Rust,
                "Rust",
                "Compiles to WebAssembly via wasm-bindgen",
            )
            .interact()?,
    };

    if interactive {
        let spinner = cliclack::spinner();
        spinner.start("Downloading templates and scaffolding project...");
        scaffold(&name, &model_type)?;
        spinner.stop("Project created");
    } else {
        scaffold(&name, &model_type)?;
        println!("Created project: {}", name);
    }

    let mut next_steps = format!(
        "Done! Created {name}.\n\n  Next steps:\n    cd {name}\n    pnpm install\n    pnpm run dev"
    );

    match model_type {
        ModelType::Python => {
            next_steps.push_str(&format!(
                "\n\n  To build the wheel:\n    cd {name}/model\n    uv build"
            ));
        }
        ModelType::Rust => {
            next_steps.push_str(&format!(
                "\n\n  To build the WASM module:\n    cd {name}/model\n    wasm-pack build --target web"
            ));
        }
    }

    if interactive {
        cliclack::outro(next_steps)?;
    } else {
        println!("{}", next_steps);
    }

    Ok(())
}

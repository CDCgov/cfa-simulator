use std::fmt;
use std::fs;
use std::path::Path;

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

// Shared templates
const TMPL_PACKAGE_JSON: &str = include_str!("templates/package.json");
const TMPL_VITE_CONFIG: &str = include_str!("templates/vite.config.ts");
const TMPL_TSCONFIG: &str = include_str!("templates/tsconfig.json");
const TMPL_INDEX_HTML: &str = include_str!("templates/index.html");
const TMPL_MAIN_TS: &str = include_str!("templates/src/main.ts");
const TMPL_ENV_DTS: &str = include_str!("templates/src/env.d.ts");

// Python templates
const TMPL_PYTHON_APP: &str = include_str!("templates/python/App.vue");
const TMPL_PYTHON_PYPROJECT: &str = include_str!("templates/python/pyproject.toml");
const TMPL_PYTHON_INIT: &str = include_str!("templates/python/__init__.py");

// Rust templates
const TMPL_RUST_APP: &str = include_str!("templates/rust/App.vue");
const TMPL_RUST_CARGO: &str = include_str!("templates/rust/model/Cargo.toml");
const TMPL_RUST_LIB: &str = include_str!("templates/rust/model/src/lib.rs");

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
    let cwd = std::env::current_dir()?;
    let project_dir = cwd.join(name);

    if project_dir.exists() {
        return Err(format!("Directory '{}' already exists", name).into());
    }

    // Write shared files
    let pkg_json = render(TMPL_PACKAGE_JSON, name);
    let pkg_json = match model_type {
        ModelType::Python => inject_dependency(&pkg_json, "@cfasim-ui/pyodide", "^0.1.1"),
        ModelType::Rust => inject_dependency(&pkg_json, "@cfasim-ui/wasm", "^0.1.1"),
    };
    write_file(&project_dir, "package.json", &pkg_json)?;
    write_file(
        &project_dir,
        "vite.config.ts",
        &render(TMPL_VITE_CONFIG, name),
    )?;
    write_file(&project_dir, "tsconfig.json", &render(TMPL_TSCONFIG, name))?;
    write_file(&project_dir, "index.html", &render(TMPL_INDEX_HTML, name))?;
    write_file(&project_dir, "src/main.ts", &render(TMPL_MAIN_TS, name))?;
    write_file(&project_dir, "src/env.d.ts", &render(TMPL_ENV_DTS, name))?;

    // Write model-specific files
    let module_name = to_module_name(name);
    match model_type {
        ModelType::Python => {
            write_file(&project_dir, "src/App.vue", &render(TMPL_PYTHON_APP, name))?;
            write_file(
                &project_dir,
                "model/pyproject.toml",
                &render(TMPL_PYTHON_PYPROJECT, name),
            )?;
            write_file(
                &project_dir,
                &format!("model/src/{module_name}/__init__.py"),
                &render(TMPL_PYTHON_INIT, name),
            )?;
        }
        ModelType::Rust => {
            write_file(&project_dir, "src/App.vue", &render(TMPL_RUST_APP, name))?;
            write_file(
                &project_dir,
                "model/Cargo.toml",
                &render(TMPL_RUST_CARGO, name),
            )?;
            write_file(
                &project_dir,
                "model/src/lib.rs",
                &render(TMPL_RUST_LIB, name),
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
        spinner.start("Scaffolding project...");
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

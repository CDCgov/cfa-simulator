mod docs;
mod init;
mod proc;
mod project;
mod run;
mod settings;
mod test;
mod tools;
mod update;
mod update_check;

use anyhow::Result;
use clap::{Parser, Subcommand, ValueEnum};

#[derive(Parser)]
#[command(name = "cfasim", about = "CFA Simulator CLI")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize a new cfasim project
    Init {
        /// Target directory (name is derived from directory name; defaults to current directory if provided without a value)
        #[arg(long, default_missing_value = ".")]
        dir: Option<String>,

        /// Template: python or rust (skips interactive prompt)
        #[arg(long)]
        template: Option<TemplateArg>,

        /// Use local templates instead of downloading from GitHub
        #[arg(long)]
        local: bool,
    },
    /// Update cfasim to the latest release
    Update,
    /// Check your system for the tools needed to develop cfasim projects
    Tools {
        /// Skip network-bound update checks (faster, works offline)
        #[arg(long)]
        offline: bool,
    },
    /// List cfasim-ui components and charts (LLM-friendly with --json)
    Docs {
        /// Emit the raw JSON directory instead of the human-readable listing
        #[arg(long)]
        json: bool,
    },
    /// Run tests for the current cfasim project (unit and e2e by default)
    Test {
        /// Run only unit tests (`uv run pytest` or `cargo test`)
        #[arg(long)]
        unit: bool,
        /// Run only end-to-end tests (`pnpm test:e2e`)
        #[arg(long)]
        e2e: bool,
    },
    /// Start the Vite dev server for the current cfasim project
    Run {
        /// Extra arguments forwarded to `vite` (prefix with `--`, e.g. `cfasim run -- --port 5174`)
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        args: Vec<String>,
    },
}

#[derive(Clone, ValueEnum)]
enum TemplateArg {
    Python,
    Rust,
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let is_update = matches!(cli.command, Commands::Update);
    let is_tools = matches!(cli.command, Commands::Tools { .. });
    let is_docs = matches!(cli.command, Commands::Docs { .. });
    let is_test = matches!(cli.command, Commands::Test { .. });
    let is_run = matches!(cli.command, Commands::Run { .. });
    if !is_update {
        settings::prompt_for_updates_if_first_run();
    }
    let result = match cli.command {
        Commands::Init {
            dir,
            template,
            local,
        } => {
            let template = template.map(|t| match t {
                TemplateArg::Python => init::Template::Python,
                TemplateArg::Rust => init::Template::Rust,
            });
            init::run(dir, template, local).map_err(|e| anyhow::anyhow!("{e}"))
        }
        Commands::Update => update::run(),
        Commands::Tools { offline } => tools::run(offline),
        Commands::Docs { json } => docs::run(json),
        Commands::Test { unit, e2e } => test::run(unit, e2e),
        Commands::Run { args } => run::run(args),
    };

    if !is_update && !is_tools && !is_docs && !is_test && !is_run {
        update_check::maybe_print_update_hint();
    }
    result
}

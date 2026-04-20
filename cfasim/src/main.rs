mod init;
mod settings;
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
    Tools,
}

#[derive(Clone, ValueEnum)]
enum TemplateArg {
    Python,
    Rust,
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let is_update = matches!(cli.command, Commands::Update);
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
        Commands::Tools => tools::run(),
    };

    if !is_update {
        update_check::maybe_print_update_hint();
    }
    result
}

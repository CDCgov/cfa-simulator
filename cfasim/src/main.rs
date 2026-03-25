mod init;

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
}

#[derive(Clone, ValueEnum)]
enum TemplateArg {
    Python,
    Rust,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Init {
            dir,
            template,
            local,
        } => {
            let template = template.map(|t| match t {
                TemplateArg::Python => init::Template::Python,
                TemplateArg::Rust => init::Template::Rust,
            });
            init::run(dir, template, local)?;
        }
    }
    Ok(())
}

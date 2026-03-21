mod new;

use clap::{Parser, Subcommand, ValueEnum};

#[derive(Parser)]
#[command(name = "cfasim", about = "CFA Simulator CLI")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Create a new cfasim project
    New {
        /// Project name (skips interactive prompt)
        #[arg(long)]
        name: Option<String>,

        /// Model type: python or rust (skips interactive prompt)
        #[arg(long)]
        model: Option<ModelArg>,
    },
}

#[derive(Clone, ValueEnum)]
enum ModelArg {
    Python,
    Rust,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    match cli.command {
        Commands::New { name, model } => {
            let model_type = model.map(|m| match m {
                ModelArg::Python => new::ModelType::Python,
                ModelArg::Rust => new::ModelType::Rust,
            });
            new::run(name, model_type)?;
        }
    }
    Ok(())
}

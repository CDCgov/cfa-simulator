# Getting Started

## Prerequisites

- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/) v10+ (enabled via `corepack enable`)
- [plz](https://plzplz.org) — the project's task runner

## Setup

Clone the repo and install dependencies:

```bash
git clone <repo-url>
cd cfa-simulator
plz install
```

`plz` is the project's task runner — see `plz.toml` for all available tasks.

## Creating a new project

Use the `cfasim` CLI to scaffold a new simulation project:

```bash
plz init
```

This will interactively prompt for a template (Python or Rust), then scaffold a Vite + Vue app with cfasim-ui and the appropriate worker setup in the current directory (deriving the project name from the directory name).

You can also run it non-interactively:

```bash
cargo run -p cfasim -- init --dir my-sim --template python
```

## Project structure

| Directory    | What it is                                     |
| ------------ | ---------------------------------------------- |
| `cfasim/`    | CLI tool for scaffolding new projects (Rust)   |
| `cfasim-ui/` | Shared components, charts, and theming library |
| `examples/`  | Example projects (Python and Rust)             |
| `docs/`      | This documentation site (VitePress)            |
| `scripts/`   | Build and scaffolding scripts                  |

## Task running

Run `plz` from the root of the repository to see all available tasks.

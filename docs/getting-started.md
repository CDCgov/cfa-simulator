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

## Project structure

| Directory    | What it is                                     |
| ------------ | ---------------------------------------------- |
| `cfasim-ui/` | Shared components, charts, and theming library |
| `docs/`      | This documentation site (VitePress)            |
| `scripts/`   | Build and scaffolding scripts                  |

## Task running

Run `plz` from the root of the repository to see all available tasks.

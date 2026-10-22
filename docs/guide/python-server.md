# Python Server Projects

A project whose Python model runs as **tasks on a local server** instead of in the browser. Choose it over the [Pyodide setup](./python) when a run takes minutes (MCMC, large ensembles), needs packages Pyodide cannot load (JAX, numpyro, pyrenew), or should leave results on disk to keep and compare. The page starts a task, streams its progress and log, plots the outputs, and lists earlier runs to reload. The API and the HTTP protocol are on the [Server](../cfasim-ui/server) page.

Prerequisites are the same as for [Python projects](./python#prerequisites), plus the [`cfasim` CLI](../getting-started#install-the-cfasim-cli): `cfasim serve` is the server, and it runs your tasks in a worker under `uv`. (The Vite plugin falls back to `uvx cfasim` when the CLI is not installed.)

## Scaffold with `cfasim init`

```bash
uvx cfasim init          # pick "Python server", or pass --template python-server
cd my-project
pnpm install && uv sync
pnpm dev
```

`pnpm dev` starts Vite and, through the `cfasimServer` plugin, `cfasim serve`, which finds `src/my_project/tasks.py` and runs it in a worker process; the dev server proxies `/api` to it. `pnpm server` runs the server alone.

```
my-project/
├── pyproject.toml          # depends on cfasim-model
├── src/my_project/
│   ├── __init__.py         # the model: pure functions, unit-tested
│   └── tasks.py            # @task wrappers the page can start
├── output/                 # one folder per run (gitignored)
├── vite.config.ts          # cfasimServer() starts the server with vite
└── interactive/src/App.vue # useServerModel()
```

## The task

```python
# src/my_project/tasks.py
from cfasim_model.server import task

from . import simulate as run_simulate


@task
def simulate(ctx, steps: int = 10, rate: float = 2.5):
    ctx.progress(0.0, "simulating")
    return run_simulate(steps, rate)
```

A task takes the context first and its inputs as keyword arguments, sent by the page as JSON. Return `model_outputs(...)` as a Pyodide model would, a dict of pandas or polars DataFrames, or call `ctx.emit(outputs)` for results along the way: emitted tables accumulate, so each call adds what is new (`ctx.emit(prior=frame)` works too) and the page shows everything emitted so far. Anything else a run produces (CSVs, figures, a report) goes in `ctx.run_dir`, and the page can list and download it.

## The page

```vue
<script setup lang="ts">
import { reactive } from "vue";
import { useServerModel } from "cfasim-ui/server";

const params = reactive({ steps: 10, rate: 2.5 });
const { start, cancel, load, current, runs } = useServerModel();
</script>

<template>
  <Button @click="start('simulate', { ...params })">Run</Button>
  <Button v-if="current.active.value" @click="cancel()">Cancel</Button>
  <progress
    v-if="current.active.value"
    :value="current.progress.value?.fraction ?? 0"
    max="1"
  />
  <LineChart
    v-if="current.outputs.value?.series"
    :data="current.outputs.value.series.column('values')"
  />
  <button v-for="r in runs" :key="r.run_id" @click="load(r.run_id)">
    {{ r.name ?? r.created_at }}
  </button>
</template>
```

`current` follows the run you started or loaded, `runs` lists what is on disk, and `useRun(id)` follows a second run for a side-by-side comparison. The scaffolded `App.vue` is the complete version of this.

## Bayesian priors with numpyro

Let users edit priors with [`PriorInput`](../cfasim-ui/components/prior-input); its value converts on the server with `to_distribution`, and `run_mcmc` streams the posterior in chunks while sampling continues:

```python
from cfasim_model.numpyro import priors_from_specs, run_mcmc


@task
def calibrate(ctx, priors: dict, chunks: int = 4):
    mcmc = build_mcmc(priors_from_specs(priors))  # your numpyro.infer.MCMC
    return run_mcmc(ctx, mcmc, jax.random.key(0), chunks=chunks, **data)
```

See the [numpyro helpers](../cfasim-ui/server#numpyro-helpers) for the details and the JAX setup notes. A model with its own config file can also take the whole config as one input and let the page send it with the edited priors merged in; the run's saved `inputs.json` is then exactly what was fit.

## Existing projects and deployment

For a project that already exists: `uv add cfasim-model`, write a `tasks.py` at the root (or point at a module with `[tool.cfasim] tasks = "my_pkg.tasks"` in `pyproject.toml`), then add the UI as in the [Pyodide guide](./python#set-up-the-frontend) with `cfasimServer()` in place of `cfasimPyodide`.

To deploy, build the site and serve it with `cfasim serve --static dist`; see [Running the server](../cfasim-ui/server#running-the-server).

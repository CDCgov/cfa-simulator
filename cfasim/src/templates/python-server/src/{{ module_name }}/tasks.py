"""Tasks the interactive UI can start on the local cfasim server.

Run the server with `pnpm server` (or let `pnpm dev` start it). Each task gets
a context for progress, logging, and outputs, plus keyword inputs from the UI.
"""

from cfasim_model.server import task

from . import simulate as run_simulate


@task
def simulate(ctx, steps: int = 10, rate: float = 2.5):
    """Run the model and return its series."""
    ctx.progress(0.0, "simulating")
    result = run_simulate(steps, rate)
    ctx.progress(1.0, "done")
    return result

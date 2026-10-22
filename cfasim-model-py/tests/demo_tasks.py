"""Tasks used by the worker tests (and by `cfasim serve` tests that spawn the
Python worker). Must be a real importable module: the worker process imports it."""

import os
import sys
import time

import numpy as np

from cfasim_model import ModelOutput, model_outputs
from cfasim_model.server import task


@task
def echo(ctx, n: int = 3, label: str = "x"):
    """Return a small table of n rows."""
    ctx.progress(0.5, "halfway")
    series = ModelOutput().add_u32("i", np.arange(n)).add_f64("v", np.arange(n) * 1.5)
    (ctx.run_dir / f"{label}.txt").write_text("custom output\n")
    return model_outputs(series=series)


@task(name="slow")
def slow_progress(ctx, steps: int = 50, delay: float = 0.2):
    for i in range(steps):
        ctx.progress(i / steps, f"step {i}")
        if i == 1:
            ctx.emit({"partial": ModelOutput().add_u32("i", np.arange(i + 1))})
        time.sleep(delay)
    return model_outputs(final=ModelOutput().add_u32("i", np.arange(steps)))


@task
def emit_only(ctx):
    """Streams two tables and returns nothing; the run still ends final."""
    ctx.emit({"a": ModelOutput().add_u32("i", np.arange(2))})
    ctx.emit(b=ModelOutput().add_u32("i", np.arange(3)))


@task
def reshape(ctx):
    """Re-emits a table with different columns; the warning must reach every run's log."""
    ctx.emit(a=ModelOutput().add_u32("i", np.arange(1)))
    ctx.emit(a=ModelOutput().add_f64("x", np.zeros(1)))


@task
def boom(ctx):
    raise RuntimeError("kaboom")


@task
def prints(ctx):
    print("hello from stdout")
    sys.stderr.write("25%\r50%\r100%\n")
    ctx.log("from ctx")


@task
def crash(ctx):
    os._exit(3)


@task
def raw_stdout(ctx):
    """A C-level write to fd 1 must reach the terminal, never the event stream."""
    os.write(1, b"raw bytes on fd 1\n")
    ctx.log("after raw")


def _square(x):
    return x * x


@task
def spawned(ctx, n: int = 3):
    """A spawn-context pool: children must be able to import this module by name."""
    import multiprocessing

    with multiprocessing.get_context("spawn").Pool(1) as pool:
        values = pool.map(_square, range(n))
    return model_outputs(squares=ModelOutput().add_u32("v", np.array(values)))


@task
def tail(ctx):
    """Output without a trailing newline must still arrive before `done`."""
    sys.stdout.write("final line without newline")

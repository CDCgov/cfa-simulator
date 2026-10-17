"""The worker process that ``cfasim serve`` starts for a Python project.

    uv run python -m cfasim_model.server.worker my_project.tasks

The worker imports the task module (so ``@task`` registrations happen here,
never in the server), announces the tasks it found, then reads one JSON command
per line from stdin and answers with JSON events on stdout. It writes
``outputs.cfasim`` into the run directory itself; only small events cross the
pipe. An EOF on stdin, or a ``shutdown`` command, ends it.

Protocol frames own stdout: the original descriptor is kept for them and file
descriptor 1 is pointed at stderr, so anything else that writes to stdout (C
extensions, subprocesses) lands in the terminal instead of the event stream.
Python-level ``print`` is captured into ``log`` events while a task runs.
Commands own stdin the same way: file descriptor 0 is pointed at the null
device, so a task that reads stdin sees EOF instead of eating a command.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import os
import sys
import traceback
from pathlib import Path

import numpy as np

from . import events
from .capture import capture_output
from .context import TaskContext
from .tasks import get_registry, import_task_module

SKIP_DIRS = frozenset({".venv", "venv", "site-packages", "node_modules", "__pycache__"})


def user_source_files(module) -> list[str]:
    """Source files the task module pulled in from its own project.

    The server watches these and restarts the worker when one changes, so
    editing tasks (or the model code next to them) takes effect on the next
    run without a manual restart. Installed packages are left out.
    """
    module_file = getattr(module, "__file__", None)
    if not module_file:
        return []
    root = Path(module_file).resolve().parent
    files = set()
    for loaded in list(sys.modules.values()):
        path = getattr(loaded, "__file__", None)
        if not path or not path.endswith(".py"):
            continue
        resolved = Path(path).resolve()
        if root not in resolved.parents:
            continue
        if any(part in SKIP_DIRS for part in resolved.relative_to(root).parts):
            continue
        files.add(str(resolved))
    files.add(str(Path(module_file).resolve()))
    return sorted(files)


def protocol_stream() -> io.TextIOWrapper:
    """Take over stdout for protocol frames and send everything else to stderr."""
    sys.stdout.flush()
    fd = os.dup(1)
    os.dup2(2, 1)
    return io.TextIOWrapper(
        os.fdopen(fd, "wb", buffering=0), encoding="utf-8", write_through=True
    )


def command_stream() -> io.TextIOWrapper:
    """Take over stdin for commands and give everything else the null device."""
    fd = os.dup(0)
    null = os.open(os.devnull, os.O_RDONLY)
    os.dup2(null, 0)
    os.close(null)
    return io.TextIOWrapper(os.fdopen(fd, "rb"), encoding="utf-8")


def _jsonable(value):
    """Non-finite floats become null (strict JSON has no NaN or Infinity)."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, np.generic):
        return _jsonable(value.item())
    return value


class Poster:
    def __init__(self, stream):
        self._stream = stream

    def __call__(self, event: dict) -> None:
        frame = json.dumps(
            _jsonable(event), separators=(",", ":"), allow_nan=False, default=str
        )
        # The leading newline ends any partial line that reached the real
        # stdout, so a frame always starts its own line.
        self._stream.write("\n" + frame + "\n")


def run_task(registry, post, command: dict) -> None:
    run_id = command.get("run_id", "")
    name = command.get("task", "")
    inputs = command.get("inputs") or {}
    ctx = TaskContext(
        run_id,
        Path(command.get("run_dir") or "."),
        post,
        write_csv=bool(command.get("csv")),
    )
    spec = registry.get(name)
    failure = None
    # The terminal event goes out after the capture block, so whatever the
    # capture flushes at the end (a last line without a newline) precedes it.
    with capture_output(post, run_id):
        try:
            if spec is None:
                raise LookupError(f"unknown task {name!r}")
            result = spec.fn(ctx, **inputs)
            if result is not None:
                ctx.emit(result, partial=False)
        except BaseException as exc:  # noqa: BLE001 - any failure is the run's error
            failure = (f"{type(exc).__name__}: {exc}", traceback.format_exc())
    if failure is None:
        ctx._send(events.DONE)
    else:
        ctx._send(events.ERROR, message=failure[0], traceback=failure[1])


def serve_worker(module_spec: str) -> int:
    """Run the worker loop; returns the exit code."""
    post = Poster(protocol_stream())
    commands = command_stream()
    try:
        module = import_task_module(module_spec)
    except BaseException as exc:  # noqa: BLE001 - reported to the server, then exit
        post(
            events.make_event(
                events.WORKER_EXITED,
                None,
                exitcode=1,
                message=f"failed to import task module {module_spec!r}: {exc}",
                traceback=traceback.format_exc(),
            )
        )
        return 1

    registry = get_registry()
    post(
        events.make_event(
            events.WORKER_READY,
            None,
            protocol=events.PROTOCOL,
            pid=os.getpid(),
            tasks=[spec.to_dict() for spec in registry.values()],
            files=user_source_files(module),
        )
    )
    for line in commands:
        line = line.strip()
        if not line:
            continue
        try:
            command = json.loads(line)
        except ValueError:
            command = None
        if not isinstance(command, dict):
            print(
                f"cfasim worker: ignoring malformed command {line!r}", file=sys.stderr
            )
            continue
        cmd = command.get("cmd")
        if cmd == "shutdown":
            return 0  # a plain return runs atexit cleanup, unlike a kill
        if cmd == "run":
            run_task(registry, post, command)
        else:
            print(f"cfasim worker: unknown command {cmd!r}", file=sys.stderr)
    return 0


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="python -m cfasim_model.server.worker",
        description="Task worker started by `cfasim serve`; speaks JSON lines on stdin/stdout.",
    )
    parser.add_argument(
        "module",
        help="dotted module path (my_project.tasks) or a .py file that registers @task functions",
    )
    args = parser.parse_args(argv)
    sys.exit(serve_worker(args.module))


if __name__ == "__main__":
    main()

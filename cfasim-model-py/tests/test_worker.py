"""The stdio worker process: `python -m cfasim_model.server.worker`."""

import json
import subprocess
import sys

import pytest

from cfasim_model.outputs_file import read_outputs

from conftest import DEMO_TASKS


class Worker:
    def __init__(self, module_spec):
        self.proc = subprocess.Popen(
            [sys.executable, "-m", "cfasim_model.server.worker", module_spec],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        self.stray = []

    def send(self, **command):
        self.proc.stdin.write(json.dumps(command) + "\n")
        self.proc.stdin.flush()

    def read_event(self):
        """The next protocol frame; non-frame lines are collected as `stray`."""
        while True:
            line = self.proc.stdout.readline()
            if not line:
                return None
            line = line.strip()
            if not line:
                continue
            if line.startswith("{"):
                return json.loads(line)
            self.stray.append(line)

    def read_until(self, *terminal):
        events = []
        while True:
            event = self.read_event()
            if event is None:
                return events
            events.append(event)
            if event["type"] in terminal:
                return events

    def close(self):
        try:
            self.proc.stdin.close()
        except OSError:
            pass
        out = self.proc.stdout.read()
        err = self.proc.stderr.read()
        return self.proc.wait(10), out, err


@pytest.fixture
def worker():
    w = Worker(DEMO_TASKS)
    yield w
    if w.proc.poll() is None:
        w.proc.kill()
        w.proc.wait()


def test_ready_lists_tasks_and_source_files(worker):
    ready = worker.read_event()
    assert ready["type"] == "worker_ready"
    assert ready["protocol"] == "1.0"
    assert ready["pid"] == worker.proc.pid
    names = {t["name"] for t in ready["tasks"]}
    assert {"echo", "slow", "boom", "prints", "crash", "spawned", "raw_stdout"} <= names
    echo = next(t for t in ready["tasks"] if t["name"] == "echo")
    assert echo["params"] == [
        {"name": "n", "required": False, "default": 3, "annotation": "int"},
        {"name": "label", "required": False, "default": "x", "annotation": "str"},
    ]
    assert DEMO_TASKS in ready["files"]


def test_echo_run_writes_outputs_and_user_files(worker, tmp_path):
    worker.read_event()
    run_dir = tmp_path / "run"
    run_dir.mkdir()
    worker.send(
        cmd="run",
        run_id="r1",
        task="echo",
        inputs={"n": 4, "label": "note"},
        run_dir=str(run_dir),
    )
    events = worker.read_until("done", "error")
    assert [e["type"] for e in events] == ["progress", "outputs", "done"]
    assert all(e["run_id"] == "r1" for e in events)
    assert events[0]["message"] == "halfway"
    assert events[1] == {
        **events[1],
        "revision": 1,
        "partial": False,
        "names": ["series"],
    }
    decoded = read_outputs(run_dir / "outputs.cfasim")
    assert decoded["outputs"]["series"]["length"] == 4
    assert (run_dir / "note.txt").read_text() == "custom output\n"
    # The worker is reusable: a second run on the same process.
    worker.send(
        cmd="run", run_id="r2", task="echo", inputs={}, run_dir=str(run_dir), csv=True
    )
    assert worker.read_until("done", "error")[-1]["type"] == "done"
    assert (run_dir / "series.csv").read_text().splitlines()[0] == "i,v"


def test_partial_emits(worker, tmp_path):
    worker.read_event()
    worker.send(
        cmd="run",
        run_id="r",
        task="slow",
        inputs={"steps": 3, "delay": 0},
        run_dir=str(tmp_path),
    )
    events = worker.read_until("done", "error")
    outputs = [e for e in events if e["type"] == "outputs"]
    assert [(o["revision"], o["partial"], o["names"]) for o in outputs] == [
        (1, True, ["partial"]),
        (2, False, ["final"]),
    ]


def test_error_and_unknown_task(worker, tmp_path):
    worker.read_event()
    worker.send(cmd="run", run_id="r", task="boom", inputs={}, run_dir=str(tmp_path))
    error = worker.read_until("done", "error")[-1]
    assert error["type"] == "error"
    assert error["message"] == "RuntimeError: kaboom"
    assert "kaboom" in error["traceback"]
    worker.send(cmd="run", run_id="r", task="nope", inputs={}, run_dir=str(tmp_path))
    error = worker.read_until("done", "error")[-1]
    assert "unknown task 'nope'" in error["message"]


def test_prints_are_log_events_and_raw_stdout_stays_out(worker, tmp_path):
    worker.read_event()
    worker.send(cmd="run", run_id="r", task="prints", inputs={}, run_dir=str(tmp_path))
    events = worker.read_until("done", "error")
    logs = [
        (e["stream"], e["line"])
        for e in events
        if e["type"] == "log" and not e["overwrite"]
    ]
    assert logs == [
        ("stdout", "hello from stdout"),
        ("stderr", "100%"),
        ("task", "from ctx"),
    ]
    # One write holding the whole line: nothing is left pending to overwrite.
    assert not [e for e in events if e["type"] == "log" and e["overwrite"]]

    worker.send(
        cmd="run", run_id="r", task="raw_stdout", inputs={}, run_dir=str(tmp_path)
    )
    events = worker.read_until("done", "error")
    assert [e["type"] for e in events] == ["log", "done"]
    assert worker.stray == []
    worker.send(cmd="shutdown")
    code, out, err = worker.close()
    assert code == 0
    assert out.strip() == ""
    assert "raw bytes on fd 1" in err


def test_eof_ends_the_worker(worker):
    worker.read_event()
    code, _, _ = worker.close()
    assert code == 0


def test_crash_exits_with_the_task_code(worker, tmp_path):
    worker.read_event()
    worker.send(cmd="run", run_id="r", task="crash", inputs={}, run_dir=str(tmp_path))
    assert worker.read_until("done", "error") == []
    assert worker.proc.wait(10) == 3


def test_import_failure_is_reported(tmp_path):
    bad = tmp_path / "bad_tasks.py"
    bad.write_text("raise ImportError('no such thing')\n")
    w = Worker(str(bad))
    event = w.read_event()
    assert event["type"] == "worker_exited"
    assert "no such thing" in event["message"]
    assert "ImportError" in event["traceback"]
    assert w.close()[0] == 1


def test_spawn_pool_children_can_import_the_task_module(worker, tmp_path):
    worker.read_event()
    worker.send(
        cmd="run", run_id="r", task="spawned", inputs={"n": 4}, run_dir=str(tmp_path)
    )
    events = worker.read_until("done", "error")
    assert events[-1]["type"] == "done", events
    assert (
        read_outputs(tmp_path / "outputs.cfasim")["outputs"]["squares"]["length"] == 4
    )


def test_trailing_output_precedes_done(worker, tmp_path):
    worker.read_event()
    worker.send(cmd="run", run_id="r", task="tail", inputs={}, run_dir=str(tmp_path))
    events = worker.read_until("done", "error")
    assert [e["type"] for e in events] == ["log", "done"]
    assert events[0]["line"] == "final line without newline"
    assert events[0]["overwrite"] is False


def test_malformed_commands_are_ignored(worker, tmp_path):
    worker.read_event()
    worker.proc.stdin.write("not json\n[1]\n\n")
    worker.send(cmd="bogus")
    worker.send(cmd="run", run_id="r", task="echo", inputs={}, run_dir=str(tmp_path))
    assert worker.read_until("done", "error")[-1]["type"] == "done"
    worker.send(cmd="shutdown")
    code, _, err = worker.close()
    assert code == 0
    assert "malformed command" in err and "unknown command" in err


def _strict_json(line):
    def reject(constant):
        raise ValueError(f"non-standard JSON constant {constant}")

    return json.loads(line, parse_constant=reject)


EDGE_TASKS = """
import math
import sys

import numpy as np

from cfasim_model.server import task


@task
def nonfinite(ctx, x: float = math.inf, y: float = math.nan):
    ctx.progress(float("nan"), "nan progress")
    ctx.progress(np.float32(2.0))
    ctx.log(str(x))


@task
def reads_stdin(ctx):
    ctx.log(repr(sys.stdin.read()))
    try:
        input()
    except EOFError:
        ctx.log("eof")
"""


@pytest.fixture
def edge_worker(tmp_path):
    path = tmp_path / "edge_tasks.py"
    path.write_text(EDGE_TASKS)
    w = Worker(str(path))
    yield w
    if w.proc.poll() is None:
        w.proc.kill()
        w.proc.wait()


def test_frames_are_strict_json(edge_worker, tmp_path):
    line = edge_worker.proc.stdout.readline()
    while not line.strip():
        line = edge_worker.proc.stdout.readline()
    ready = _strict_json(line)
    nonfinite = next(t for t in ready["tasks"] if t["name"] == "nonfinite")
    assert [p["default"] for p in nonfinite["params"]] == [None, None]

    edge_worker.send(
        cmd="run", run_id="r", task="nonfinite", inputs={}, run_dir=str(tmp_path)
    )
    progress = []
    while True:
        line = edge_worker.proc.stdout.readline().strip()
        if not line:
            continue
        event = _strict_json(line)
        if event["type"] == "progress":
            progress.append(event["fraction"])
        if event["type"] in ("done", "error"):
            break
    assert event["type"] == "done", event
    assert progress == [None, 1.0]


def test_tasks_reading_stdin_see_eof(edge_worker, tmp_path):
    edge_worker.read_event()
    edge_worker.send(
        cmd="run", run_id="r1", task="reads_stdin", inputs={}, run_dir=str(tmp_path)
    )
    # A command queued behind the run must survive the task's stdin reads.
    edge_worker.send(
        cmd="run", run_id="r2", task="reads_stdin", inputs={}, run_dir=str(tmp_path)
    )
    for run_id in ("r1", "r2"):
        events = edge_worker.read_until("done", "error")
        assert events[-1] == {**events[-1], "type": "done", "run_id": run_id}
        assert [e["line"] for e in events if e["type"] == "log"] == ["''", "eof"]

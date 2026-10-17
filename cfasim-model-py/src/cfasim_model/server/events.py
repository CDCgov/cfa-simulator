"""Event names and payloads the worker sends to `cfasim serve`."""

from __future__ import annotations

from datetime import datetime

PROGRESS = "progress"
LOG = "log"
OUTPUTS = "outputs"
DONE = "done"
ERROR = "error"

# Internal worker lifecycle messages; never forwarded to clients.
WORKER_READY = "worker_ready"
WORKER_EXITED = "worker_exited"

# Worker protocol version, major.minor. The server warns when the major differs
# from its own; minor versions only add fields.
PROTOCOL = "1.0"


def now_iso() -> str:
    """Local time with its offset, matching the server's status documents."""
    return datetime.now().astimezone().isoformat(timespec="milliseconds")


def make_event(type_: str, run_id: str | None = None, **fields) -> dict:
    event = {"type": type_, "run_id": run_id, "time": now_iso()}
    event.update(fields)
    return event

"""The ``ctx`` object handed to every task."""

from __future__ import annotations

import math
import warnings
from pathlib import Path
from typing import Callable

from .. import outputs_file
from . import events

OUTPUTS_FILENAME = "outputs.cfasim"


class SchemaChangeWarning(UserWarning):
    """A re-emitted table changed its column names or types."""


def _schema(table: dict) -> list[tuple[str, str]]:
    """Column names and types; enum labels may legitimately grow between emits."""
    return [(c["name"], c["type"]) for c in table["columns"]]


class TaskContext:
    """Progress, logging, and output hooks for a running task.

    ``run_dir`` belongs to the task: write CSVs, figures, or reports there and
    the server lists and serves them under ``/api/runs/{id}/files``.

    Tables emitted during a run accumulate: each ``emit`` adds to (or replaces
    by name) what earlier emits published, and the whole set is written as the
    next revision. The accumulated tables are held in memory until the run
    ends.
    """

    def __init__(
        self,
        run_id: str,
        run_dir: Path,
        post: Callable[[dict], None],
        *,
        write_csv: bool = False,
    ):
        self.run_id = run_id
        self.run_dir = Path(run_dir)
        self._post = post
        self._write_csv = write_csv
        self._outputs: dict[str, dict] = {}
        self.revision = 0

    def _send(self, type_: str, **fields) -> None:
        self._post(events.make_event(type_, self.run_id, **fields))

    def progress(self, fraction: float, message: str | None = None) -> None:
        fraction = float(fraction)
        self._send(
            events.PROGRESS,
            fraction=None if math.isnan(fraction) else max(0.0, min(1.0, fraction)),
            message=message,
        )

    def log(self, line: str) -> None:
        self._send(events.LOG, stream="task", line=str(line), overwrite=False)

    def emit(self, outputs=None, /, **tables) -> None:
        """Publish tables as a new revision of ``outputs.cfasim``.

        ``outputs`` is a ``model_outputs()`` result or a mapping of name to
        ``ModelOutput`` or DataFrame; ``tables`` are the same, given by
        keyword (``outputs`` is positional-only, so a table may use that
        name). Tables from earlier emits stay unless a new one has the same
        name; called with nothing, it republishes the current set. The run's
        final revision is the state when the task returns.
        """
        self._publish(outputs, tables, final=False)

    def clear(self) -> None:
        """Forget the tables emitted so far; the next emit starts from nothing."""
        self._outputs.clear()

    def _publish(self, outputs, tables: dict, *, final: bool) -> None:
        for value in (outputs, tables):
            if value is None:
                continue
            for name, table in outputs_file.normalize_outputs(value)["outputs"].items():
                old = self._outputs.get(name)
                if old is not None and _schema(old) != _schema(table):
                    warnings.warn(
                        f"emit replaced table {name!r} with a different schema: "
                        f"{_schema(old)} -> {_schema(table)}",
                        SchemaChangeWarning,
                        stacklevel=3,
                    )
                self._outputs[name] = table
        canonical = {"__modelOutputs": True, "outputs": self._outputs}
        outputs_file.write_outputs(self.run_dir / OUTPUTS_FILENAME, canonical)
        self.revision += 1
        self._announce(final)

    def _finish(self, result=None) -> None:
        """Publish what the task returned, if anything, as the final revision.

        With no result the last revision is re-announced as final; a run that
        never emitted gets no outputs event at all.
        """
        if result is not None:
            self._publish(result, {}, final=True)
        elif self.revision:
            self._announce(final=True)

    def _announce(self, final: bool) -> None:
        if final and self._write_csv:
            outputs_file.write_csvs(
                self.run_dir, {"__modelOutputs": True, "outputs": self._outputs}
            )
        self._send(
            events.OUTPUTS,
            revision=self.revision,
            partial=not final,
            names=list(self._outputs),
        )

"""The ``ctx`` object handed to every task."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Callable

from .. import outputs_file
from . import events

OUTPUTS_FILENAME = "outputs.cfasim"


class TaskContext:
    """Progress, logging, and output hooks for a running task.

    ``run_dir`` belongs to the task: write CSVs, figures, or reports there and
    the server lists and serves them under ``/api/runs/{id}/files``.
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

    def emit(self, outputs, *, partial: bool = True) -> None:
        """Write ``outputs.cfasim`` and tell subscribers a new revision exists."""
        canonical = outputs_file.normalize_outputs(outputs)
        outputs_file.write_outputs(self.run_dir / OUTPUTS_FILENAME, canonical)
        if self._write_csv and not partial:
            outputs_file.write_csvs(self.run_dir, canonical)
        self.revision += 1
        self._send(
            events.OUTPUTS,
            revision=self.revision,
            partial=partial,
            names=list(canonical["outputs"].keys()),
        )

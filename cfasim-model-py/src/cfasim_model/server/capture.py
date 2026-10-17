"""Redirect a task's stdout/stderr into ``log`` events.

Progress bars rewrite their line with ``\\r``; those updates are forwarded as
``overwrite`` events (throttled) so a UI can replace the previous line, and the
final ``\\n``-terminated text is logged once.
"""

from __future__ import annotations

import contextlib
import io
import re
import sys
import time
from typing import Callable

from . import events

ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
OVERWRITE_INTERVAL = 0.25


class LineWriter(io.TextIOBase):
    def __init__(
        self,
        stream: str,
        post: Callable[[dict], None],
        run_id: str,
        clock: Callable[[], float] = time.monotonic,
    ):
        super().__init__()
        self.stream = stream
        self._post = post
        self._run_id = run_id
        self._clock = clock
        self._pending = ""
        # Last non-empty text shown on the current line, so a bar that ends
        # with "\r" and then "\n" still logs its final state.
        self._shown = ""
        self._last_overwrite = float("-inf")

    @property
    def encoding(self) -> str:  # type: ignore[override]
        return "utf-8"

    def writable(self) -> bool:
        return True

    def isatty(self) -> bool:
        return False

    def _emit(self, line: str, overwrite: bool) -> None:
        self._post(
            events.make_event(
                events.LOG,
                self._run_id,
                stream=self.stream,
                line=line,
                overwrite=overwrite,
            )
        )

    def write(self, s: str) -> int:
        self._pending += ANSI_RE.sub("", str(s))
        while "\n" in self._pending:
            line, self._pending = self._pending.split("\n", 1)
            self._emit(_current_segment(line) or self._shown, overwrite=False)
            self._shown = ""
            self._last_overwrite = float("-inf")
        if "\r" in self._pending:
            # Only the text after the last carriage return is still on the
            # line; remember what was shown and drop the rest, or a long
            # progress bar grows this buffer without bound.
            segment = _current_segment(self._pending)
            self._shown = segment or self._shown
            self._pending = self._pending.rpartition("\r")[2]
            now = self._clock()
            if segment.strip() and now - self._last_overwrite >= OVERWRITE_INTERVAL:
                self._emit(segment, overwrite=True)
                self._last_overwrite = now
        return len(s)

    def flush(self) -> None:
        pass

    def finish(self) -> None:
        """Flush a trailing line with no newline."""
        last = _current_segment(self._pending) or self._shown
        if last.strip():
            self._emit(last, overwrite=False)
        self._pending = self._shown = ""


def _current_segment(text: str) -> str:
    """The text a terminal would show after carriage returns: the last
    non-empty segment (progress bars write both ``\\r10%`` and ``10%\\r``)."""
    parts = text.split("\r")
    for part in reversed(parts):
        if part.strip():
            return part
    return ""


@contextlib.contextmanager
def capture_output(post: Callable[[dict], None], run_id: str):
    out = LineWriter("stdout", post, run_id)
    err = LineWriter("stderr", post, run_id)
    saved = sys.stdout, sys.stderr
    sys.stdout, sys.stderr = out, err
    try:
        yield
    finally:
        sys.stdout, sys.stderr = saved
        out.finish()
        err.finish()

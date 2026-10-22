"""Task definitions for the local cfasim server (``cfasim serve``).

A ``tasks.py`` does ``from cfasim_model.server import task`` and decorates its
functions; ``cfasim serve`` runs this package's worker in your project's
environment (``uv run python -m cfasim_model.server.worker``), which imports
the module and runs tasks one at a time. Nothing here imports beyond the
standard library and numpy.
"""

from .context import SchemaChangeWarning, TaskContext
from .tasks import task

__all__ = ["task", "TaskContext", "SchemaChangeWarning"]

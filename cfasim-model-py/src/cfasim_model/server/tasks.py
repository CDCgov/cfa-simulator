"""Task registry: the ``@task`` decorator and module discovery."""

from __future__ import annotations

import importlib
import inspect
import sys
import types
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable


@dataclass(frozen=True)
class ParamSpec:
    name: str
    required: bool
    default: Any = None
    annotation: str | None = None

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "required": self.required,
            "default": self.default,
            "annotation": self.annotation,
        }


@dataclass(frozen=True)
class TaskSpec:
    """A registered task and its signature, as described to the page."""

    name: str
    params: tuple[ParamSpec, ...]
    accepts_extra: bool
    fn: Callable[..., Any] = field(compare=False)
    doc: str | None = None

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "doc": self.doc,
            "params": [p.to_dict() for p in self.params],
            "accepts_extra": self.accepts_extra,
        }


_REGISTRY: dict[str, TaskSpec] = {}


def get_registry() -> dict[str, TaskSpec]:
    return _REGISTRY


def _json_default(value: Any) -> Any:
    if value is inspect.Parameter.empty:
        return None
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return repr(value)


def _introspect(fn: Callable[..., Any]) -> tuple[tuple[ParamSpec, ...], bool]:
    sig = inspect.signature(fn)
    params = list(sig.parameters.values())
    if not params:
        raise TypeError(
            f"task {fn.__name__!r} must accept the context as its first parameter"
        )
    specs = []
    accepts_extra = False
    for p in params[1:]:
        if p.kind is inspect.Parameter.VAR_KEYWORD:
            accepts_extra = True
            continue
        if p.kind is inspect.Parameter.VAR_POSITIONAL:
            continue
        annotation = None
        if p.annotation is not inspect.Parameter.empty:
            annotation = getattr(p.annotation, "__name__", None) or str(p.annotation)
        specs.append(
            ParamSpec(
                name=p.name,
                required=p.default is inspect.Parameter.empty,
                default=_json_default(p.default),
                annotation=annotation,
            )
        )
    return tuple(specs), accepts_extra


def task(fn: Callable[..., Any] | None = None, *, name: str | None = None):
    """Register ``fn(ctx, **inputs)`` as a server task.

    Usable bare (``@task``) or with a name (``@task(name="calibrate")``).
    """

    def register(f: Callable[..., Any]) -> Callable[..., Any]:
        task_name = name or f.__name__
        if task_name in _REGISTRY:
            raise ValueError(f"task {task_name!r} is already registered")
        params, accepts_extra = _introspect(f)
        _REGISTRY[task_name] = TaskSpec(
            name=task_name,
            params=params,
            accepts_extra=accepts_extra,
            doc=inspect.getdoc(f),
            fn=f,
        )
        return f

    if fn is not None:
        return register(fn)
    return register


def import_task_module(spec: str) -> types.ModuleType:
    """Import the module that registers tasks.

    ``spec`` is either a dotted module path (``my_project.tasks``) or a path to
    a ``.py`` file (``tasks.py``). A file is imported under its own stem with
    its directory on ``sys.path``, so sibling imports resolve and
    ``multiprocessing`` spawn children can import the module again by name.
    """
    if spec.endswith(".py") or "/" in spec or spec.startswith("."):
        path = Path(spec).resolve()
        if not path.is_file():
            raise FileNotFoundError(f"task module not found: {path}")
        parent = str(path.parent)
        if parent not in sys.path:
            sys.path.insert(0, parent)
        module = importlib.import_module(path.stem)
        module_file = getattr(module, "__file__", None)
        if not module_file or Path(module_file).resolve() != path:
            raise ImportError(
                f"import {path.stem!r} resolved to {module_file}, not {path}; "
                "another module shadows the task file"
            )
        return module
    return importlib.import_module(spec)

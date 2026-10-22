import warnings

import numpy as np
import pytest

from cfasim_model import ModelOutput
from cfasim_model.outputs_file import read_outputs
from cfasim_model.server import SchemaChangeWarning, TaskContext


def table(n):
    return ModelOutput().add_u32("i", np.arange(n))


def names_in_file(run_dir):
    return {
        k: v["length"]
        for k, v in read_outputs(run_dir / "outputs.cfasim")["outputs"].items()
    }


def test_emits_accumulate_and_replace_by_name(tmp_path):
    events = []
    ctx = TaskContext("r", tmp_path, events.append)
    ctx.emit({"a": table(1)})
    ctx.emit(b=table(2))
    ctx.emit({"a": table(3)}, c=table(4))
    assert [(e["revision"], e["partial"], e["names"]) for e in events] == [
        (1, True, ["a"]),
        (2, True, ["a", "b"]),
        (3, True, ["a", "b", "c"]),
    ]
    assert names_in_file(tmp_path) == {"a": 3, "b": 2, "c": 4}


def test_clear_drops_earlier_tables(tmp_path):
    events = []
    ctx = TaskContext("r", tmp_path, events.append)
    ctx.emit(a=table(1))
    ctx.clear()
    ctx.emit(b=table(2))
    assert events[-1]["names"] == ["b"]
    assert names_in_file(tmp_path) == {"b": 2}


def test_finish_marks_last_revision_final_and_writes_csvs(tmp_path):
    events = []
    ctx = TaskContext("r", tmp_path, events.append, write_csv=True)
    ctx._finish()
    assert events == []  # nothing emitted, nothing to finalize
    ctx.emit(a=table(2))
    assert not (tmp_path / "a.csv").exists()
    ctx._finish()
    assert [(e["revision"], e["partial"]) for e in events] == [(1, True), (1, False)]
    assert (tmp_path / "a.csv").read_text().splitlines() == ["i", "0", "1"]


def test_returned_tables_merge_as_the_final_revision(tmp_path):
    events = []
    ctx = TaskContext("r", tmp_path, events.append)
    ctx.emit(a=table(1))
    ctx._finish({"b": table(2)})
    assert [(e["revision"], e["partial"], e["names"]) for e in events] == [
        (1, True, ["a"]),
        (2, False, ["a", "b"]),
    ]


def test_a_table_may_be_named_outputs(tmp_path):
    events = []
    ctx = TaskContext("r", tmp_path, events.append)
    ctx.emit(outputs=table(1))
    assert events[-1]["names"] == ["outputs"]


def test_non_mapping_outputs_raise_a_type_error(tmp_path):
    ctx = TaskContext("r", tmp_path, lambda e: None)
    # A multi-element array has no truth value, like a DataFrame; the error
    # must still come from normalize_outputs, not from testing it for truth.
    with pytest.raises(TypeError, match="model_outputs\\(\\) result or a mapping"):
        ctx.emit(np.arange(3))


def test_empty_emit_republishes(tmp_path):
    events = []
    ctx = TaskContext("r", tmp_path, events.append)
    ctx.emit(a=table(1))
    ctx.emit()
    assert [(e["revision"], e["names"]) for e in events] == [(1, ["a"]), (2, ["a"])]


def test_schema_change_on_replace_warns(tmp_path):
    ctx = TaskContext("r", tmp_path, lambda e: None)
    ctx.emit(a=table(1))
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        ctx.emit(a=table(5))  # more rows, same columns: fine
    with pytest.warns(
        SchemaChangeWarning, match="replaced table 'a' with a different schema"
    ) as rec:
        ctx.emit(a=ModelOutput().add_f64("x", np.zeros(1)))
    assert rec[0].filename == __file__  # points at the task's emit call

import pytest

from cfasim_model.server.tasks import import_task_module, task


def test_task_registers_with_default_and_explicit_names(fresh_registry):
    @task
    def alpha(ctx, a: int, b: float = 1.5, *, c="x"):
        "Alpha does things."

    @task(name="renamed")
    def beta(ctx, **extra):
        pass

    assert set(fresh_registry) == {"alpha", "renamed"}
    spec = fresh_registry["alpha"]
    assert spec.doc == "Alpha does things."
    assert [p.to_dict() for p in spec.params] == [
        {"name": "a", "required": True, "default": None, "annotation": "int"},
        {"name": "b", "required": False, "default": 1.5, "annotation": "float"},
        {"name": "c", "required": False, "default": "x", "annotation": None},
    ]
    assert spec.accepts_extra is False
    assert fresh_registry["renamed"].accepts_extra is True
    assert fresh_registry["renamed"].params == ()


def test_duplicate_name_raises(fresh_registry):
    @task
    def dup(ctx):
        pass

    with pytest.raises(ValueError):

        @task(name="dup")
        def other(ctx):
            pass


def test_task_without_ctx_parameter_raises(fresh_registry):
    with pytest.raises(TypeError):

        @task
        def nothing():
            pass


def test_import_task_module_from_file(fresh_registry, tmp_path):
    (tmp_path / "helper.py").write_text("VALUE = 7\n")
    (tmp_path / "my_tasks.py").write_text(
        "from helper import VALUE\nfrom cfasim_model.server import task\n"
        "@task\ndef t(ctx):\n    return VALUE\n"
    )
    module = import_task_module(str(tmp_path / "my_tasks.py"))
    assert module.VALUE == 7
    assert "t" in fresh_registry
    assert import_task_module(str(tmp_path / "my_tasks.py")) is module


def test_import_task_module_missing_file():
    with pytest.raises(FileNotFoundError):
        import_task_module("/nonexistent/tasks.py")

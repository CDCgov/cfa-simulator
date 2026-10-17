import sys
from pathlib import Path

import pytest

TESTS_DIR = Path(__file__).parent
DEMO_TASKS = str(TESTS_DIR / "demo_tasks.py")


@pytest.fixture
def fresh_registry(monkeypatch):
    """Isolate @task registrations made by a test."""
    from cfasim_model.server import tasks

    monkeypatch.setattr(tasks, "_REGISTRY", {})
    return tasks._REGISTRY


@pytest.fixture
def fake_numpyro(monkeypatch):
    """A stand-in numpyro so helpers can be tested without jax."""
    import types

    dist = types.ModuleType("numpyro.distributions")

    class Distribution:
        pass

    class Normal(Distribution):
        def __init__(self, loc=0.0, scale=1.0):
            self.loc, self.scale = loc, scale

    class Gamma(Distribution):
        def __init__(self, concentration, rate=1.0):
            self.concentration, self.rate = concentration, rate

    class NotADistribution:
        pass

    def Truncated(loc=0.0, scale=1.0, *, low=None, high=None):
        """A factory function, like numpyro's TruncatedNormal."""
        return Normal(loc, scale)

    dist.Distribution = Distribution
    dist.Normal = Normal
    dist.Gamma = Gamma
    dist.NotADistribution = NotADistribution
    dist.Truncated = Truncated

    diagnostics = types.ModuleType("numpyro.diagnostics")

    def summary(samples, prob=0.9, group_by_chain=True):
        import collections

        import numpy as np

        out = {}
        for name, arr in samples.items():
            arr = np.asarray(arr)
            flat = arr.reshape(-1, *arr.shape[2:])
            out[name] = collections.OrderedDict(
                [
                    ("mean", flat.mean(axis=0)),
                    ("std", flat.std(axis=0)),
                    ("median", np.median(flat, axis=0)),
                    (f"{(1 - prob) / 2:.1%}", flat.min(axis=0)),
                    (f"{1 - (1 - prob) / 2:.1%}", flat.max(axis=0)),
                    ("n_eff", np.full(flat.shape[1:], 100.0)),
                    ("r_hat", np.full(flat.shape[1:], 1.0)),
                ]
            )
        return out

    def hpdi(x, prob=0.9, axis=0):
        import numpy as np

        return np.stack([np.min(x, axis=axis), np.max(x, axis=axis)])

    diagnostics.summary = summary
    diagnostics.hpdi = hpdi

    numpyro = types.ModuleType("numpyro")
    numpyro.distributions = dist
    numpyro.diagnostics = diagnostics

    jax = types.ModuleType("jax")
    jax.device_get = lambda x: x

    monkeypatch.setitem(sys.modules, "numpyro", numpyro)
    monkeypatch.setitem(sys.modules, "numpyro.distributions", dist)
    monkeypatch.setitem(sys.modules, "numpyro.diagnostics", diagnostics)
    monkeypatch.setitem(sys.modules, "jax", jax)
    return numpyro

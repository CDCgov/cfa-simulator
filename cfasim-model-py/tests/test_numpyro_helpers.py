import numpy as np
import pytest

from cfasim_model.numpyro import (
    is_distribution_spec,
    posterior_outputs,
    priors_from_specs,
    run_mcmc,
    to_distribution,
)
from cfasim_model.outputs_file import normalize_outputs


def test_to_distribution_canonical(fake_numpyro):
    d = to_distribution({"family": "Normal", "params": {"loc": 2.0, "scale": 0.5}})
    assert isinstance(d, fake_numpyro.distributions.Normal)
    assert (d.loc, d.scale) == (2.0, 0.5)


def test_to_distribution_aliases(fake_numpyro):
    d = to_distribution(
        {"distribution": "Gamma", "args": [2.0], "kwargs": {"rate": 3.0}}
    )
    assert (d.concentration, d.rate) == (2.0, 3.0)
    d = to_distribution({"type": "Normal"})
    assert (d.loc, d.scale) == (0.0, 1.0)


def test_to_distribution_errors(fake_numpyro):
    with pytest.raises(ValueError, match="unknown numpyro distribution 'Nope'"):
        to_distribution({"family": "Nope"})
    with pytest.raises(ValueError, match="is not a numpyro distribution"):
        to_distribution({"family": "NotADistribution"})
    truncated = to_distribution(
        {"family": "Truncated", "params": {"loc": 1.0, "low": 0.0}}
    )
    assert isinstance(truncated, fake_numpyro.distributions.Normal)
    with pytest.raises(ValueError, match="Truncated does not accept sigma"):
        to_distribution({"family": "Truncated", "params": {"sigma": 1}})
    with pytest.raises(
        ValueError, match="does not accept sigma; its parameters are loc, scale"
    ):
        to_distribution({"family": "Normal", "params": {"sigma": 1}})
    with pytest.raises(ValueError, match="not a distribution spec"):
        to_distribution({"loc": 1})
    assert not is_distribution_spec(3)


def test_priors_from_specs(fake_numpyro):
    priors = priors_from_specs(
        {
            "a": {"family": "Normal"},
            "b": {"family": "Gamma", "params": {"concentration": 1}},
        }
    )
    assert set(priors) == {"a", "b"}
    with pytest.raises(ValueError, match="prior 'c'"):
        priors_from_specs({"c": 5})


def test_posterior_outputs_flattens_sites(fake_numpyro):
    rng = np.random.default_rng(0)
    samples = {
        "beta": rng.normal(size=(2, 5)),
        "theta": np.arange(2 * 5 * 2 * 3, dtype=float).reshape(2, 5, 2, 3),
    }
    out = normalize_outputs(posterior_outputs(samples))
    posterior = out["outputs"]["posterior"]
    names = [c["name"] for c in posterior["columns"]]
    assert names[:3] == ["chain", "draw", "beta"]
    assert names[3:5] == ["theta[0,0]", "theta[0,1]"]
    assert len(names) == 3 + 6
    assert posterior["length"] == 10
    np.testing.assert_array_equal(posterior["buffers"][0], [0] * 5 + [1] * 5)
    np.testing.assert_array_equal(posterior["buffers"][1], list(range(5)) * 2)
    np.testing.assert_array_equal(posterior["buffers"][2], samples["beta"].reshape(-1))
    # theta[1,2] for chain 0 draw 1 is the element at (0, 1, 1, 2)
    idx = names.index("theta[1,2]")
    assert posterior["buffers"][idx][1] == samples["theta"][0, 1, 1, 2]

    summary = out["outputs"]["summary"]
    site = summary["columns"][0]
    assert site["type"] == "enum"
    assert site["enumLabels"] == names[2:]
    assert [c["name"] for c in summary["columns"][1:]] == [
        "mean",
        "std",
        "median",
        "hpdi_low",
        "hpdi_high",
        "n_eff",
        "r_hat",
    ]
    mean = summary["buffers"][1]
    assert mean[0] == pytest.approx(samples["beta"].mean())


def test_posterior_outputs_options(fake_numpyro):
    samples = {"a": np.zeros((2, 4)), "b": np.zeros((2, 4, 50))}
    with pytest.raises(ValueError, match="51 columns"):
        posterior_outputs(samples, max_columns=10)
    out = normalize_outputs(posterior_outputs(samples, sites=["a"]))
    assert [c["name"] for c in out["outputs"]["posterior"]["columns"]] == [
        "chain",
        "draw",
        "a",
    ]
    ungrouped = normalize_outputs(
        posterior_outputs({"a": np.zeros(4)}, group_by_chain=False)
    )
    assert ungrouped["outputs"]["posterior"]["length"] == 4
    with pytest.raises(ValueError, match="no posterior sites"):
        posterior_outputs({}, group_by_chain=False)


class FakeState:
    def __init__(self, key):
        self.rng_key = key


class FakeMCMC:
    """Mimics the numpyro MCMC continuation API closely enough for run_mcmc."""

    def __init__(self, num_warmup=10, num_samples=8):
        self.num_warmup = num_warmup
        self.num_samples = num_samples
        self.calls = []
        self.post_warmup_state = None
        self.last_state = None
        self._counter = 0

    def warmup(self, key, **kw):
        self.calls.append(("warmup", key, kw))
        self.post_warmup_state = FakeState(key + 1)

    def run(self, key, **kw):
        self.calls.append(("run", key, self.num_samples, kw))
        start = self._counter
        self._counter += self.num_samples
        self._samples = {
            "x": np.arange(start, self._counter, dtype=float)[np.newaxis, :]
        }
        self.last_state = FakeState(key + 1)

    def get_samples(self, group_by_chain=True):
        return self._samples


class FakeCtx:
    def __init__(self):
        self.progress_calls = []
        self.emits = []

    def progress(self, fraction, message=None):
        self.progress_calls.append((round(fraction, 3), message))

    def emit(self, outputs):
        self.emits.append(normalize_outputs(outputs))


def test_run_mcmc_single_chunk(fake_numpyro):
    mcmc, ctx = FakeMCMC(), FakeCtx()
    samples = run_mcmc(ctx, mcmc, 0, chunks=1, y=1)
    assert [c[0] for c in mcmc.calls] == ["run"]
    assert mcmc.calls[0][3] == {"y": 1}
    assert samples["x"].shape == (1, 8)
    assert ctx.progress_calls[-1] == (1.0, "done")
    assert len(ctx.emits) == 1


def test_run_mcmc_chunked(fake_numpyro):
    mcmc, ctx = FakeMCMC(num_warmup=8, num_samples=8), FakeCtx()
    samples = run_mcmc(ctx, mcmc, 0, chunks=4)
    kinds = [c[0] for c in mcmc.calls]
    assert kinds == ["warmup", "run", "run", "run", "run"]
    assert all(c[2] == 2 for c in mcmc.calls[1:])
    assert mcmc.num_samples == 8
    np.testing.assert_array_equal(samples["x"][0], np.arange(8))
    assert len(ctx.emits) == 4
    assert ctx.emits[0]["outputs"]["posterior"]["length"] == 2
    assert ctx.emits[-1]["outputs"]["posterior"]["length"] == 8
    fractions = [f for f, _ in ctx.progress_calls]
    assert fractions == sorted(fractions)
    assert fractions[1] == 0.5 and fractions[-1] == 1.0
    with pytest.raises(ValueError, match="divisible"):
        run_mcmc(ctx, FakeMCMC(num_samples=7), 0, chunks=2)
    with pytest.raises(ValueError, match="at least 1"):
        run_mcmc(ctx, FakeMCMC(), 0, chunks=0)


def test_posterior_outputs_short_chains_skip_diagnostics(fake_numpyro):
    samples = {"x": np.array([[1.0, 3.0], [5.0, 7.0]])}
    summary = normalize_outputs(posterior_outputs(samples))["outputs"]["summary"]
    stats = dict(zip([c["name"] for c in summary["columns"]], summary["buffers"]))
    assert stats["mean"].tolist() == [4.0]
    assert stats["hpdi_low"].tolist() == [1.0]
    assert np.isnan(stats["n_eff"][0]) and np.isnan(stats["r_hat"][0])

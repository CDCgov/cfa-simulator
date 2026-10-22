"""run_mcmc and posterior_outputs against real numpyro; skipped without it."""

import numpy as np
import pytest

from cfasim_model.outputs_file import normalize_outputs

numpyro = pytest.importorskip("numpyro")
jax = pytest.importorskip("jax")

from cfasim_model.numpyro import run_mcmc  # noqa: E402


class Ctx:
    def __init__(self):
        self.emits = []

    def progress(self, fraction, message=None):
        pass

    def emit(self, outputs):
        self.emits.append(normalize_outputs(outputs))


def model():
    numpyro.sample("mu", numpyro.distributions.Normal(0, 1))


def make_mcmc(num_samples):
    kernel = numpyro.infer.NUTS(model)
    return numpyro.infer.MCMC(
        kernel,
        num_warmup=20,
        num_samples=num_samples,
        num_chains=2,
        chain_method="sequential",
        progress_bar=False,
    )


@pytest.mark.parametrize("num_samples, chunks", [(16, 4), (16, 8), (20, 10)])
def test_chunked_run_mcmc(num_samples, chunks):
    ctx = Ctx()
    samples = run_mcmc(
        ctx, make_mcmc(num_samples), jax.random.PRNGKey(0), chunks=chunks
    )
    assert samples["mu"].shape == (2, num_samples)
    assert len(ctx.emits) == chunks
    per_chunk = num_samples // chunks
    for i, outputs in enumerate(ctx.emits):
        draws = per_chunk * (i + 1)
        summary = outputs["outputs"]["summary"]
        stats = dict(zip([c["name"] for c in summary["columns"]], summary["buffers"]))
        assert outputs["outputs"]["posterior"]["length"] == 2 * draws
        assert np.isfinite(stats["mean"][0])
        assert np.isfinite(stats["r_hat"][0]) == (draws >= 4)


def test_chunks_match_a_single_run():
    key = jax.random.PRNGKey(1)
    whole = run_mcmc(Ctx(), make_mcmc(16), key, chunks=1)
    chunked = run_mcmc(Ctx(), make_mcmc(16), key, chunks=4)
    np.testing.assert_allclose(whole["mu"], chunked["mu"])

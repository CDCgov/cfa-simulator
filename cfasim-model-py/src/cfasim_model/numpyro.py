"""numpyro conveniences: prior specs, posterior tables, and chunked sampling.

numpyro and jax are imported inside each function; this module is importable
without them and they are never a dependency of ``cfasim-model``.
"""

from __future__ import annotations

import inspect
from typing import Any, Mapping

import numpy as np

from . import ModelOutput, model_outputs

SPEC_FAMILY_KEYS = ("family", "distribution", "type")
SPEC_PARAM_KEYS = ("params", "kwargs")


def is_distribution_spec(value: Any) -> bool:
    return isinstance(value, Mapping) and any(k in value for k in SPEC_FAMILY_KEYS)


def _dist_module():
    try:
        import numpyro.distributions as dist
    except ImportError as exc:  # pragma: no cover - exercised only without numpyro
        raise ImportError("cfasim_model.numpyro needs numpyro installed") from exc
    return dist


def to_distribution(spec: Mapping[str, Any]):
    """Build ``numpyro.distributions.<family>(**params)`` from a prior spec.

    The canonical shape is ``{"family": "Normal", "params": {"loc": 0, "scale": 1}}``
    (what the ``PriorInput`` component emits). ``distribution``/``type`` are
    accepted for ``family``, ``kwargs`` for ``params``, and ``args`` passes
    positional arguments, so existing config files work unchanged.
    """
    if not is_distribution_spec(spec):
        raise ValueError(f"not a distribution spec: {spec!r}")
    family = next(spec[k] for k in SPEC_FAMILY_KEYS if k in spec)
    params = dict(next((spec[k] for k in SPEC_PARAM_KEYS if k in spec), {}) or {})
    args = list(spec.get("args", []) or [])

    dist = _dist_module()
    # Classes and factory functions alike (TruncatedNormal, Bernoulli, ...).
    factory = getattr(dist, family, None)
    if not callable(factory):
        raise ValueError(f"unknown numpyro distribution {family!r}")

    try:
        sig = inspect.signature(factory)
    except (TypeError, ValueError):
        sig = None
    if sig is not None and not any(
        p.kind is inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()
    ):
        accepted = list(sig.parameters)
        unknown = sorted(k for k in params if k not in accepted)
        if unknown:
            raise ValueError(
                f"{family} does not accept {', '.join(unknown)}; "
                f"its parameters are {', '.join(accepted)}"
            )
    result = factory(*args, **params)
    if not isinstance(result, dist.Distribution):
        raise ValueError(f"{family} is not a numpyro distribution")
    return result


def priors_from_specs(specs: Mapping[str, Mapping[str, Any]]) -> dict[str, Any]:
    """Convert a mapping of name to spec into a mapping of name to distribution."""
    priors = {}
    for name, spec in specs.items():
        if not is_distribution_spec(spec):
            raise ValueError(f"prior {name!r} is not a distribution spec: {spec!r}")
        priors[name] = to_distribution(spec)
    return priors


def _flatten_site(name: str, arr: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """Split ``(chains, draws, *shape)`` into named 1-D columns of chains*draws."""
    chains, draws = arr.shape[:2]
    flat = arr.reshape(chains * draws, -1)
    if arr.ndim == 2:
        return [(name, flat[:, 0])]
    columns = []
    for i, idx in enumerate(np.ndindex(*arr.shape[2:])):
        columns.append((f"{name}[{','.join(str(j) for j in idx)}]", flat[:, i]))
    return columns


def _grouped_samples(samples_or_mcmc, group_by_chain: bool) -> dict[str, np.ndarray]:
    if hasattr(samples_or_mcmc, "get_samples"):
        samples = samples_or_mcmc.get_samples(group_by_chain=True)
        group_by_chain = True
    else:
        samples = samples_or_mcmc
    try:
        import jax

        to_host = jax.device_get
    except ImportError:  # pragma: no cover
        to_host = lambda x: x  # noqa: E731
    grouped = {}
    for name, value in samples.items():
        arr = np.asarray(to_host(value), dtype=np.float64)
        if not group_by_chain:
            arr = arr[np.newaxis, ...]
        grouped[name] = arr
    return grouped


def posterior_outputs(
    samples_or_mcmc,
    *,
    sites: list[str] | None = None,
    group_by_chain: bool = True,
    prob: float = 0.9,
    max_columns: int = 2000,
) -> dict:
    """Posterior draws and diagnostics as ``model_outputs(posterior=…, summary=…)``.

    ``posterior`` has ``chain``, ``draw`` and one f64 column per scalar site;
    array sites become ``name[i]`` / ``name[i,j]`` columns. ``summary`` has one
    row per column with mean, std, median, HPDI bounds, n_eff and r_hat.
    """
    grouped = _grouped_samples(samples_or_mcmc, group_by_chain)
    if sites is not None:
        grouped = {k: v for k, v in grouped.items() if k in sites}
    if not grouped:
        raise ValueError("no posterior sites to export")

    columns: list[tuple[str, np.ndarray]] = []
    for name, arr in grouped.items():
        columns.extend(_flatten_site(name, arr))
    if len(columns) > max_columns:
        raise ValueError(
            f"posterior would have {len(columns)} columns (limit {max_columns}); "
            "pass sites=[...] to select sites or raise max_columns"
        )

    first = next(iter(grouped.values()))
    chains, draws = first.shape[:2]
    posterior = (
        ModelOutput()
        .add_u32("chain", np.repeat(np.arange(chains), draws))
        .add_u32("draw", np.tile(np.arange(draws), chains))
    )
    for name, values in columns:
        posterior.add_f64(name, values)

    from numpyro.diagnostics import hpdi
    from numpyro.diagnostics import summary as np_summary

    # Rows of mean, std, median, HPDI low/high, n_eff, r_hat per site.
    site_rows = []
    if draws >= 4:
        stats = np_summary(grouped, prob=prob, group_by_chain=True)
        for name in grouped:
            # The HPDI keys are named after `prob`, so read them positionally.
            site_rows.append([np.asarray(v).reshape(-1) for v in stats[name].values()])
    else:
        # numpyro's split R-hat needs 4 draws per chain; an early partial
        # emit gets the summary statistics with NaN diagnostics.
        for arr in grouped.values():
            flat = arr.reshape(chains * draws, -1)
            lo, hi = np.asarray(hpdi(flat, prob, axis=0))
            missing = np.full(flat.shape[1], np.nan)
            center = [flat.mean(0), flat.std(0), np.median(flat, 0)]
            site_rows.append([*center, lo, hi, missing, missing])
    keys = ("mean", "std", "median", "hpdi_low", "hpdi_high", "n_eff", "r_hat")
    fields = {
        key: np.concatenate([rows[i] for rows in site_rows])
        for i, key in enumerate(keys)
    }
    labels = [name for name, _ in columns]

    summary = ModelOutput().add_enum("site", np.arange(len(labels)), labels)
    for key, vec in fields.items():
        summary.add_f64(key, vec)
    return model_outputs(posterior=posterior, summary=summary)


def run_mcmc(
    ctx,
    mcmc,
    rng_key,
    *,
    chunks: int = 1,
    sites: list[str] | None = None,
    prob: float = 0.9,
    **model_kwargs,
) -> dict[str, np.ndarray]:
    """Run ``mcmc`` and report progress through ``ctx``.

    With ``chunks > 1`` the sampling phase is split into equal pieces; after
    each piece the posterior so far is emitted as partial outputs, so a UI can
    show it filling in. Returns the samples grouped by chain. Afterwards
    ``mcmc.get_samples()`` only holds the last chunk; use the return value.
    """
    if chunks < 1:
        raise ValueError("chunks must be at least 1")
    if chunks == 1:
        ctx.progress(0.0, "sampling")
        mcmc.run(rng_key, **model_kwargs)
        samples = _grouped_samples(mcmc, True)
        ctx.progress(1.0, "done")
        ctx.emit(posterior_outputs(samples, sites=sites, prob=prob), partial=False)
        return samples

    num_samples = mcmc.num_samples
    if num_samples % chunks:
        raise ValueError(
            f"num_samples ({num_samples}) must be divisible by chunks ({chunks})"
        )
    per_chunk = num_samples // chunks
    warmup_share = mcmc.num_warmup / (mcmc.num_warmup + num_samples)

    ctx.progress(0.0, "warmup")
    mcmc.warmup(rng_key, **model_kwargs)
    ctx.progress(warmup_share, "warmup done")
    key = mcmc.post_warmup_state.rng_key

    pieces: list[dict[str, np.ndarray]] = []
    try:
        mcmc.num_samples = per_chunk
        for i in range(chunks):
            mcmc.run(key, **model_kwargs)
            pieces.append(_grouped_samples(mcmc, True))
            mcmc.post_warmup_state = mcmc.last_state
            key = mcmc.last_state.rng_key
            samples = {
                name: np.concatenate([p[name] for p in pieces], axis=1)
                for name in pieces[0]
            }
            ctx.progress(
                warmup_share + (1 - warmup_share) * (i + 1) / chunks,
                f"chunk {i + 1}/{chunks}",
            )
            ctx.emit(
                posterior_outputs(samples, sites=sites, prob=prob),
                partial=i + 1 < chunks,
            )
    finally:
        mcmc.num_samples = num_samples
    return samples

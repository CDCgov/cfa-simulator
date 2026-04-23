import numpy as np

from cfasim_model import ModelOutput, model_outputs


def step(state, rate):
    """Advance the model one step forward (pure — easy to test)."""
    return state + rate


def simulate(steps, rate):
    time = np.zeros(steps, dtype=np.float64)
    values = np.zeros(steps, dtype=np.float64)
    state = 0.0
    for t in range(steps):
        time[t] = t
        values[t] = state
        state = step(state, rate)

    series = ModelOutput().add_f64("time", time).add_f64("values", values)
    return model_outputs(series=series)

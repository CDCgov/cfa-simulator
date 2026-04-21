import numpy as np
from cfasim_model import ModelOutput, model_outputs


def double(n):
    return n * 2


def simulate(steps, rate):
    time = np.arange(steps, dtype=np.float64)
    values = time * rate

    series = ModelOutput().add_f64("time", time).add_f64("values", values)

    return model_outputs(series=series)

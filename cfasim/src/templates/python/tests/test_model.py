import numpy as np

from %%module_name%% import double, simulate


def test_double():
    assert double(3) == 6
    assert double(0) == 0
    assert double(-4) == -8


def test_simulate_shape():
    result = simulate(steps=5, rate=2.0)
    series = result["outputs"]["series"]
    assert series["length"] == 5
    names = [c["name"] for c in series["columns"]]
    assert names == ["time", "values"]


def test_simulate_values():
    result = simulate(steps=4, rate=3.0)
    buffers = result["outputs"]["series"]["buffers"]
    time, values = buffers
    np.testing.assert_array_equal(time, [0.0, 1.0, 2.0, 3.0])
    np.testing.assert_array_equal(values, [0.0, 3.0, 6.0, 9.0])

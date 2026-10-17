import datetime as dt

import numpy as np
import pytest

from cfasim_model import DATE_MISSING, ModelOutput


class FakeSeries:
    def __init__(self, values):
        self.values = values

    def to_numpy(self):
        return np.asarray(self.values)


class FakeFrame:
    """The slice of the pandas/polars API that from_dataframe relies on."""

    def __init__(self, **columns):
        self.columns = list(columns)
        self._columns = {k: FakeSeries(v) for k, v in columns.items()}

    def __getitem__(self, name):
        return self._columns[name]


def column(output, name):
    for col_name, typ, data, labels in output._columns:
        if col_name == name:
            return typ, data, labels
    raise KeyError(name)


def test_add_date_accepts_dates_strings_and_datetime64():
    out = (
        ModelOutput()
        .add_date("a", [dt.date(1970, 1, 2), None])
        .add_date("b", ["2026-01-05", "2026-01-06"])
        .add_date("c", np.array(["2026-01-05", "NaT"], dtype="datetime64[D]"))
    )
    assert column(out, "a")[1].tolist() == [1, DATE_MISSING]
    assert column(out, "b")[1].tolist() == [20458, 20459]
    assert column(out, "c")[1].tolist() == [20458, DATE_MISSING]
    assert column(out, "a")[1].dtype == np.uint32
    with pytest.raises(ValueError, match="before 1970"):
        ModelOutput().add_date("d", [dt.date(1969, 12, 31)])


def test_add_strings_builds_an_enum():
    out = ModelOutput().add_strings("zone", ["b", "a", "b", None])
    typ, data, labels = column(out, "zone")
    assert typ == "enum"
    assert labels == ["b", "a", ""]
    assert data.tolist() == [0, 1, 0, 2]
    fixed = ModelOutput().add_strings("zone", ["a"], labels=["x", "a"])
    assert column(fixed, "zone")[1].tolist() == [1]
    with pytest.raises(ValueError, match="not in labels"):
        ModelOutput().add_strings("zone", ["q"], labels=["a"])


def test_from_dataframe_maps_dtypes():
    df = FakeFrame(
        f=[1.5, 2.5],
        i=np.array([1, -2], dtype=np.int64),
        big=np.array([2**40, 0], dtype=np.int64),
        u=np.array([1, 2], dtype=np.uint8),
        b=[True, False],
        d=np.array(["2026-01-05", "2026-01-06"], dtype="datetime64[D]"),
        s=["x", "y"],
    )
    out = ModelOutput.from_dataframe(df, labels={"s": ["y", "x"]})
    types = {name: typ for name, typ, _, _ in out._columns}
    assert types == {
        "f": "f64",
        "i": "i32",
        "big": "f64",
        "u": "u32",
        "b": "bool",
        "d": "date",
        "s": "enum",
    }
    assert column(out, "s")[1].tolist() == [1, 0]
    assert column(out, "d")[1].tolist() == [20458, 20459]
    wire = out.to_dict()
    assert wire["length"] == 2


class FakeNA:
    """Stands in for pandas.NA, which raises when used as a bool."""

    def __bool__(self):
        raise TypeError("boolean value of NA is ambiguous")


FakeNA.__name__ = "NAType"


def test_from_dataframe_edge_dtypes():
    df = FakeFrame(
        u_big=np.array([2**32 + 5, 1], dtype=np.uint64),
        u_ok=np.array([2**32 - 1, 0], dtype=np.uint64),
        td=np.array([1, 36], dtype="timedelta64[h]"),
        nb=np.array([True, FakeNA()], dtype=object),
        nb_none=np.array([False, None], dtype=object),
        s=np.array(["a", FakeNA()], dtype=object),
        s_nan=np.array(["a", float("nan")], dtype=object),
    )
    out = ModelOutput.from_dataframe(df)
    types = {name: typ for name, typ, _, _ in out._columns}
    assert types == {
        "u_big": "f64",
        "u_ok": "u32",
        "td": "f64",
        "nb": "f64",
        "nb_none": "f64",
        "s": "enum",
        "s_nan": "enum",
    }
    assert column(out, "u_big")[1].tolist() == [2**32 + 5, 1]
    assert column(out, "td")[1].tolist() == [1 / 24, 1.5]
    assert column(out, "nb")[1].tolist()[0] == 1.0
    assert np.isnan(column(out, "nb")[1][1])
    assert column(out, "nb_none")[1].tolist()[0] == 0.0
    assert column(out, "s")[2] == ["a", ""]
    assert column(out, "s_nan")[2] == ["a", ""]


def test_from_dataframe_stringifies_column_names():
    df = FakeFrame()
    df.columns = [0]
    df._columns = {0: FakeSeries([1.5])}
    out = ModelOutput.from_dataframe(df)
    assert out.to_dict()["columns"][0]["name"] == "0"


def test_from_dataframe_pandas():
    pd = pytest.importorskip("pandas")
    df = pd.DataFrame(
        {
            "when": pd.to_datetime(["2026-01-05 23:00", None]).tz_localize(
                "America/New_York"
            ),
            "n": pd.array([1, None], dtype="Int64"),
            "flag": pd.array([True, None], dtype="boolean"),
            "s": pd.array(["a", None], dtype="string"),
        }
    )
    out = ModelOutput.from_dataframe(df)
    types = {name: typ for name, typ, _, _ in out._columns}
    assert types == {"when": "date", "n": "f64", "flag": "f64", "s": "enum"}
    # The wall-clock date in its own zone, not the UTC one (2026-01-06).
    assert column(out, "when")[1].tolist() == [20458, DATE_MISSING]
    assert column(out, "s")[2] == ["a", ""]


def test_from_dataframe_polars():
    pl = pytest.importorskip("polars")
    df = pl.DataFrame(
        {
            "when": pl.Series(["2026-01-05 23:00"])
            .str.to_datetime()
            .dt.replace_time_zone("America/New_York"),
            "flag": pl.Series([True]),
        }
    ).vstack(
        pl.DataFrame({"when": [None], "flag": [None]}).cast(
            {"when": pl.Datetime("us", "America/New_York"), "flag": pl.Boolean}
        )
    )
    out = ModelOutput.from_dataframe(df)
    types = {name: typ for name, typ, _, _ in out._columns}
    assert types == {"when": "date", "flag": "f64"}
    assert column(out, "when")[1].tolist() == [20458, DATE_MISSING]

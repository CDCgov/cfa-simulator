import numpy as np


class ModelOutput:
    def __init__(self):
        self._columns = []

    def add_f64(self, name, data):
        self._columns.append((name, "f64", np.asarray(data, dtype=np.float64), None))
        return self

    def add_i32(self, name, data):
        self._columns.append((name, "i32", np.asarray(data, dtype=np.int32), None))
        return self

    def add_u32(self, name, data):
        self._columns.append((name, "u32", np.asarray(data, dtype=np.uint32), None))
        return self

    def add_bool(self, name, data):
        self._columns.append((name, "bool", np.asarray(data, dtype=np.uint8), None))
        return self

    def add_enum(self, name, indices, labels):
        self._columns.append(
            (name, "enum", np.asarray(indices, dtype=np.uint32), list(labels))
        )
        return self

    def add_date(self, name, dates):
        """Calendar dates, stored as days since 1970-01-01.

        Accepts ``datetime.date`` objects, ISO strings, or numpy datetime64
        values; missing dates (``None``/``NaT``) are stored as
        :data:`DATE_MISSING`.
        """
        self._columns.append((name, "date", _to_epoch_days(dates), None))
        return self

    def add_strings(self, name, values, labels=None):
        """A string column, stored as an enum of its distinct values.

        ``labels`` fixes the label order (and lets several tables share one);
        otherwise labels are the distinct values in first-seen order. Missing
        values (``None``, NaN, pandas ``NA``) become the label ``""``.
        """
        values = ["" if _is_missing(v) else str(v) for v in values]
        if labels is None:
            labels = list(dict.fromkeys(values))
        index = {label: i for i, label in enumerate(labels)}
        try:
            indices = [index[v] for v in values]
        except KeyError as exc:
            raise ValueError(f"column {name!r}: value {exc} not in labels") from None
        return self.add_enum(name, indices, labels)

    @classmethod
    def from_dataframe(cls, df, *, labels=None):
        """Build a table from a pandas or polars DataFrame (anything whose
        columns expose ``to_numpy()``).

        Floats become ``f64``, integers ``i32`` (or ``u32`` when unsigned, and
        ``f64`` when out of range), booleans ``bool``, dates ``date``, and
        strings or categoricals ``enum``. Timezone-aware datetimes keep their
        wall-clock date. Timedeltas become ``f64`` days. Nullable integers and
        booleans with missing values become ``f64`` with NaN, and missing
        strings the label ``""``. ``labels`` maps a string column to a fixed
        label list. Column names are converted to strings.
        """
        out = cls()
        labels = labels or {}
        for name in df.columns:
            values = _column_values(df[name])
            key = str(name)
            kind = values.dtype.kind
            if kind == "f":
                out.add_f64(key, values)
            elif kind == "b":
                out.add_bool(key, values)
            elif kind in "iu":
                _add_integers(out, key, values)
            elif kind == "M":
                out.add_date(key, values)
            elif kind == "m":
                out.add_f64(key, values / np.timedelta64(1, "D"))
            elif _all_bool(values):
                out.add_f64(
                    key, [np.nan if _is_missing(v) else float(v) for v in values]
                )
            else:
                out.add_strings(key, values.tolist(), labels.get(name))
        return out

    def to_dict(self):
        columns = []
        buffers = []
        for name, typ, data, labels in self._columns:
            col = {"name": name, "type": typ}
            if labels is not None:
                col["enumLabels"] = labels
            columns.append(col)
            buffers.append(data)
        return {
            "__modelOutput": True,
            "length": len(self._columns[0][2]) if self._columns else 0,
            "columns": columns,
            "buffers": buffers,
        }


DATE_MISSING = 2**32 - 1
_EPOCH = np.datetime64("1970-01-01", "D")


def _to_epoch_days(dates):
    arr = np.asarray(dates).astype("datetime64[D]")  # str, date, None, NaT all convert
    days = (arr - _EPOCH).astype(np.int64)
    missing = np.isnat(arr)
    if np.any(days[~missing] < 0):
        raise ValueError("dates before 1970-01-01 are not representable")
    return np.where(missing, DATE_MISSING, days).astype(np.uint32)


def _is_missing(value):
    # pandas NA and NaT do not compare equal to themselves (NA's comparison is
    # NA, which raises in a boolean context), so match those by type name.
    if value is None or type(value).__name__ in ("NAType", "NaTType"):
        return True
    return isinstance(value, float) and value != value


def _all_bool(values):
    """An object column of booleans with missing values (nullable bool)."""
    present = [v for v in values if not _is_missing(v)]
    return bool(present) and all(isinstance(v, (bool, np.bool_)) for v in present)


def _column_values(series):
    """The column as numpy, with timezone-aware datetimes made naive in their
    own zone (pandas would give objects, polars UTC)."""
    dtype = getattr(series, "dtype", None)
    if getattr(dtype, "tz", None) is not None:
        series = series.dt.tz_localize(None)
    elif getattr(dtype, "time_zone", None) is not None:
        series = series.dt.replace_time_zone(None)
    return series.to_numpy()


def _add_integers(out, name, values):
    lo, hi = (int(values.min()), int(values.max())) if values.size else (0, 0)
    if values.dtype.kind == "u" and hi <= 2**32 - 1:
        out.add_u32(name, values)
    elif values.dtype.kind == "i" and -(2**31) <= lo and hi < 2**31:
        out.add_i32(name, values)
    else:
        out.add_f64(name, values)


def model_outputs(**outputs):
    """Create a multi-output result from named ModelOutput instances."""
    return {
        "__modelOutputs": True,
        "outputs": {k: v.to_dict() for k, v in outputs.items()},
    }

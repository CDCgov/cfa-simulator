"""Reader and writer for the ``.cfasim`` outputs file.

Layout (all integers little-endian)::

    [0, 4)              u32 header_len
    [4, 4 + header_len) UTF-8 JSON header, right-padded with spaces so the
                        data section starts on an 8-byte boundary
    [4 + header_len, …) column buffers in column order, each padded to 8 bytes

The header is ``{"version": 1, "outputs": {name: {"length", "columns",
"byteOffsets", "byteLengths"}}}`` where ``columns`` is the same
``ColumnDescriptor`` list the browser-side ``ModelOutput`` uses and offsets are
relative to the start of the data section. The format is language-neutral; this
module is the Python reference implementation and only depends on numpy.
"""

from __future__ import annotations

import csv
import io
import json
import os
from pathlib import Path

import numpy as np

from . import DATE_MISSING, ModelOutput

FORMAT_VERSION = 1
ALIGN = 8

COLUMN_DTYPES: dict[str, str] = {
    "f64": "<f8",
    "i32": "<i4",
    "u32": "<u4",
    "bool": "u1",
    "enum": "<u4",
    "date": "<u4",  # days since 1970-01-01; DATE_MISSING for none
}


def _pad(n: int) -> int:
    return (-n) % ALIGN


def _is_dataframe(value) -> bool:
    """pandas, polars, or anything else with named columns exposing ``to_numpy``."""
    return hasattr(value, "columns")


def normalize_outputs(value) -> dict:
    """Return the canonical ``{"__modelOutputs": True, "outputs": {...}}`` dict.

    Accepts the result of :func:`cfasim_model.model_outputs`, or a mapping of
    name to :class:`cfasim_model.ModelOutput`, to a pandas/polars DataFrame
    (converted with :meth:`ModelOutput.from_dataframe`), or to the dict that
    ``ModelOutput.to_dict()`` produces.
    """
    if isinstance(value, dict) and value.get("__modelOutputs"):
        outputs = value["outputs"]
    elif isinstance(value, dict):
        outputs = {}
        for name, item in value.items():
            if _is_dataframe(item):
                item = ModelOutput.from_dataframe(item)
            if hasattr(item, "to_dict"):
                item = item.to_dict()
            if not (isinstance(item, dict) and item.get("__modelOutput")):
                raise TypeError(
                    f"output {name!r} is not a ModelOutput or DataFrame "
                    f"(got {type(item).__name__})"
                )
            outputs[name] = item
    else:
        raise TypeError(
            "outputs must be a model_outputs() result or a mapping of name to ModelOutput"
        )
    return {"__modelOutputs": True, "outputs": outputs}


def _column_array(name: str, col: dict, data, length: int) -> np.ndarray:
    typ = col["type"]
    if typ not in COLUMN_DTYPES:
        raise ValueError(f"column {name!r} has unknown type {typ!r}")
    if typ == "enum" and not isinstance(col.get("enumLabels"), list):
        raise ValueError(f"enum column {name!r} is missing enumLabels")
    arr = np.ascontiguousarray(np.asarray(data).astype(COLUMN_DTYPES[typ], copy=False))
    if arr.ndim != 1:
        raise ValueError(f"column {name!r} must be 1-D, got shape {arr.shape}")
    if len(arr) != length:
        raise ValueError(
            f"column {name!r} has {len(arr)} rows but the output declares {length}"
        )
    return arr


def encode_outputs(outputs) -> bytes:
    canonical = normalize_outputs(outputs)
    header_outputs: dict[str, dict] = {}
    buffers: list[np.ndarray] = []
    offset = 0
    for name, out in canonical["outputs"].items():
        length = int(out["length"])
        offsets: list[int] = []
        lengths: list[int] = []
        for col, data in zip(out["columns"], out["buffers"], strict=True):
            arr = _column_array(col["name"], col, data, length)
            offsets.append(offset)
            lengths.append(arr.nbytes)
            buffers.append(arr)
            offset += arr.nbytes + _pad(arr.nbytes)
        header_outputs[name] = {
            "length": length,
            "columns": out["columns"],
            "byteOffsets": offsets,
            "byteLengths": lengths,
        }

    # Raw UTF-8, as the Rust writer emits, so non-ASCII names stay byte-identical.
    header = json.dumps(
        {"version": FORMAT_VERSION, "outputs": header_outputs},
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    header += b" " * _pad(4 + len(header))

    parts = [np.uint32(len(header)).astype("<u4").tobytes(), header]
    for arr in buffers:
        parts.append(arr.tobytes())
        parts.append(b"\0" * _pad(arr.nbytes))
    return b"".join(parts)


def decode_outputs(data: bytes | bytearray | memoryview) -> dict:
    """Decode a ``.cfasim`` blob into the canonical outputs dict.

    Column buffers are read-only numpy views into ``data``.
    """
    view = memoryview(data)
    if len(view) < 4:
        raise ValueError("outputs file is truncated (no header length)")
    header_len = int(np.frombuffer(view[:4], dtype="<u4")[0])
    data_start = 4 + header_len
    if data_start > len(view):
        raise ValueError("outputs file is truncated (header)")
    header = json.loads(bytes(view[4:data_start]).decode("utf-8"))
    if header.get("version") != FORMAT_VERSION:
        raise ValueError(f"unsupported outputs file version {header.get('version')!r}")

    outputs: dict[str, dict] = {}
    for name, out in header["outputs"].items():
        buffers = []
        for col, off, nbytes in zip(
            out["columns"], out["byteOffsets"], out["byteLengths"], strict=True
        ):
            dtype = np.dtype(COLUMN_DTYPES[col["type"]])
            if nbytes != out["length"] * dtype.itemsize:
                raise ValueError(
                    f"column {col['name']!r} has {nbytes} bytes for {out['length']} rows"
                )
            start = data_start + off
            end = start + nbytes
            if end > len(view):
                raise ValueError(f"outputs file is truncated (column {col['name']!r})")
            buffers.append(np.frombuffer(view[start:end], dtype=dtype))
        outputs[name] = {
            "__modelOutput": True,
            "length": out["length"],
            "columns": out["columns"],
            "buffers": buffers,
        }
    return {"__modelOutputs": True, "outputs": outputs}


def write_outputs(path: str | os.PathLike, outputs) -> None:
    """Encode and write atomically (temp file in the same dir, then rename)."""
    path = Path(path)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(encode_outputs(outputs))
    os.replace(tmp, path)


def read_outputs(path: str | os.PathLike) -> dict:
    return decode_outputs(Path(path).read_bytes())


def output_to_csv(output: dict) -> str:
    """Render one table (a ``ModelOutput.to_dict()`` dict) as CSV with enum labels."""
    columns = output["columns"]
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow([c["name"] for c in columns])
    cols = []
    for col, data in zip(columns, output["buffers"], strict=True):
        arr = np.asarray(data)
        if col["type"] == "enum":
            labels = col["enumLabels"]
            cols.append([labels[i] for i in arr])
        elif col["type"] == "date":
            cols.append(
                [
                    "" if d == DATE_MISSING else str(np.datetime64(int(d), "D"))
                    for d in arr
                ]
            )
        elif col["type"] == "bool":
            cols.append(["true" if v else "false" for v in arr])
        elif col["type"] == "f64":
            # "NaN", not Python's "nan": R reads the former as a number.
            cols.append(["NaN" if v != v else v for v in arr.tolist()])
        else:
            cols.append(arr.tolist())
    for row in zip(*cols, strict=True):
        writer.writerow(row)
    return buf.getvalue()


def write_csvs(directory: str | os.PathLike, outputs) -> list[Path]:
    """Write ``<name>.csv`` for every table; returns the paths written."""
    directory = Path(directory)
    written = []
    for name, out in normalize_outputs(outputs)["outputs"].items():
        path = directory / f"{name}.csv"
        path.write_text(output_to_csv(out), encoding="utf-8")
        written.append(path)
    return written

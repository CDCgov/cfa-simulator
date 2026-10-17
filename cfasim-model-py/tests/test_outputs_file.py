import json

import numpy as np
import pytest

from cfasim_model import ModelOutput
from cfasim_model.outputs_file import (
    decode_outputs,
    encode_outputs,
    output_to_csv,
    read_outputs,
    write_csvs,
    write_outputs,
)

import make_fixtures
from make_fixtures import sample_outputs


def header_of(blob: bytes) -> tuple[int, dict]:
    header_len = int(np.frombuffer(blob[:4], dtype="<u4")[0])
    return header_len, json.loads(blob[4 : 4 + header_len])


def test_roundtrip_all_column_types():
    original = sample_outputs()
    decoded = decode_outputs(encode_outputs(original))
    assert decoded["__modelOutputs"] is True
    assert set(decoded["outputs"]) == {"series", "empty"}
    series = decoded["outputs"]["series"]
    assert series["length"] == 3
    assert series["columns"] == original["outputs"]["series"]["columns"]
    for col, want, got in zip(
        series["columns"], original["outputs"]["series"]["buffers"], series["buffers"]
    ):
        np.testing.assert_array_equal(got, want)
        assert got.dtype.byteorder in ("<", "=", "|")
    assert decoded["outputs"]["empty"]["length"] == 0
    assert len(decoded["outputs"]["empty"]["buffers"][0]) == 0


def test_big_endian_input_is_written_little_endian():
    big = np.array([1.0, 2.0], dtype=">f8")
    blob = encode_outputs({"t": ModelOutput().add_f64("x", big)})
    _, header = header_of(blob)
    off = header["outputs"]["t"]["byteOffsets"][0]
    header_len = int(np.frombuffer(blob[:4], dtype="<u4")[0])
    raw = blob[4 + header_len + off : 4 + header_len + off + 16]
    np.testing.assert_array_equal(np.frombuffer(raw, dtype="<f8"), [1.0, 2.0])


@pytest.mark.parametrize(
    "bad",
    [
        {
            "__modelOutputs": True,
            "outputs": {
                "t": {
                    "length": 2,
                    "columns": [{"name": "x", "type": "f64"}],
                    "buffers": [np.zeros((2, 2))],
                }
            },
        },
        {
            "__modelOutputs": True,
            "outputs": {
                "t": {
                    "length": 3,
                    "columns": [{"name": "x", "type": "f64"}],
                    "buffers": [np.zeros(2)],
                }
            },
        },
        {
            "__modelOutputs": True,
            "outputs": {
                "t": {
                    "length": 1,
                    "columns": [{"name": "x", "type": "enum"}],
                    "buffers": [np.zeros(1)],
                }
            },
        },
        {
            "__modelOutputs": True,
            "outputs": {
                "t": {
                    "length": 1,
                    "columns": [{"name": "x", "type": "f16"}],
                    "buffers": [np.zeros(1)],
                }
            },
        },
    ],
    ids=["2d", "length-mismatch", "enum-without-labels", "unknown-type"],
)
def test_invalid_outputs_raise(bad):
    with pytest.raises(ValueError):
        encode_outputs(bad)


def test_not_outputs_raise():
    with pytest.raises(TypeError):
        encode_outputs({"t": 3})
    with pytest.raises(TypeError):
        encode_outputs(42)


def test_truncated_blob_raises():
    blob = encode_outputs(sample_outputs())
    with pytest.raises(ValueError):
        decode_outputs(blob[:-4])
    with pytest.raises(ValueError):
        decode_outputs(blob[:2])


def test_byte_lengths_must_match_rows():
    blob = encode_outputs(
        {"t": ModelOutput().add_f64("a", [1.0, 2.0]).add_u32("b", [1, 2])}
    )
    header_len, header = header_of(blob)
    header["outputs"]["t"]["byteLengths"][1] = 4
    text = json.dumps(header, separators=(",", ":")).encode().ljust(header_len)
    with pytest.raises(ValueError, match="'b' has 4 bytes for 2 rows"):
        decode_outputs(blob[:4] + text + blob[4 + header_len :])


def test_write_is_atomic_and_readable(tmp_path):
    path = tmp_path / "outputs.cfasim"
    write_outputs(path, sample_outputs())
    assert path.is_file()
    assert not list(tmp_path.glob("*.tmp"))
    assert read_outputs(path)["outputs"]["series"]["length"] == 3


def test_csv_resolves_enum_labels_and_bools(tmp_path):
    text = output_to_csv(sample_outputs()["outputs"]["series"])
    lines = text.splitlines()
    assert lines[0] == "time,delta,count,flag,status,when"
    assert lines[1] == "0.0,-1,0,true,S,2026-01-05"
    assert lines[2] == "0.5,0,10,false,R,2026-01-12"
    assert lines[3].endswith(",I,")
    written = write_csvs(tmp_path, sample_outputs())
    assert sorted(p.name for p in written) == ["empty.csv", "series.csv"]
    assert (tmp_path / "empty.csv").read_text() == "nothing\n"


def test_fixtures_are_current():
    assert make_fixtures.main(["--check"]) == 0


def test_dataframes_are_accepted_as_outputs():
    from test_model_output import FakeFrame

    frame = FakeFrame(x=[1.0, 2.0], zone=["a", "b"])
    decoded = decode_outputs(encode_outputs({"t": frame}))
    out = decoded["outputs"]["t"]
    assert [c["type"] for c in out["columns"]] == ["f64", "enum"]
    assert out["columns"][1]["enumLabels"] == ["a", "b"]


def test_csv_writes_nan_like_the_rust_writer():
    table = ModelOutput().add_f64("x", np.array([1.0, float("nan")]))
    assert output_to_csv(table.to_dict()) == "x\n1.0\nNaN\n"

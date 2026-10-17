"""Write the shared protocol fixtures under tests/fixtures/.

    uv run python tests/make_fixtures.py          # write
    uv run python tests/make_fixtures.py --check  # verify unchanged

The TypeScript decoder tests (and any future implementation) read these files,
so changing them is a protocol change.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

from cfasim_model import ModelOutput, model_outputs
from cfasim_model.outputs_file import encode_outputs

FIXTURES = Path(__file__).parent / "fixtures"


def sample_outputs() -> dict:
    series = (
        ModelOutput()
        .add_f64("time", [0.0, 0.5, 1.0])
        .add_i32("delta", [-1, 0, 1])
        .add_u32("count", [0, 10, 20])
        .add_bool("flag", [1, 0, 1])
        .add_enum("status", [0, 2, 1], ["S", "I", "R"])
        .add_date("when", ["2026-01-05", "2026-01-12", None])
    )
    empty = ModelOutput().add_f64("nothing", [])
    return model_outputs(series=series, empty=empty)


def expected_columns() -> dict:
    return {
        "series": {
            "time": [0.0, 0.5, 1.0],
            "delta": [-1, 0, 1],
            "count": [0, 10, 20],
            "flag": [1, 0, 1],
            "status": [0, 2, 1],
            "when": [20458, 20465, 4294967295],
        },
        "empty": {"nothing": []},
    }


def build() -> dict[str, bytes]:
    blob = encode_outputs(sample_outputs())
    header_len = int(np.frombuffer(blob[:4], dtype="<u4")[0])
    header = json.loads(blob[4 : 4 + header_len].decode("utf-8"))
    return {
        "sample.cfasim": blob,
        "sample.header.json": (json.dumps(header, indent=2) + "\n").encode(),
        "sample.columns.json": (
            json.dumps(expected_columns(), indent=2) + "\n"
        ).encode(),
    }


def main(argv: list[str]) -> int:
    files = build()
    FIXTURES.mkdir(exist_ok=True)
    if "--check" in argv:
        stale = [n for n, b in files.items() if (FIXTURES / n).read_bytes() != b]
        if stale:
            print("fixtures out of date:", ", ".join(stale))
            return 1
        return 0
    for name, data in files.items():
        (FIXTURES / name).write_bytes(data)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

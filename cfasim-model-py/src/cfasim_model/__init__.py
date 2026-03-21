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


def model_outputs(**outputs):
    """Create a multi-output result from named ModelOutput instances."""
    return {
        "__modelOutputs": True,
        "outputs": {k: v.to_dict() for k, v in outputs.items()},
    }

//! Model output types for cfasim simulations.
//!
//! [`ModelOutput`] is one table of typed columns and [`Outputs`] a set of named
//! tables. In the browser they cross into JavaScript with [`ModelOutput::into_js`]
//! / [`model_outputs`]; with the `tasks` feature they are written to a
//! `.cfasim` outputs file by the [`tasks`] worker that `cfasim serve` runs.

#[cfg(feature = "wasm")]
use js_sys::{Array, Float64Array, Int32Array, Object, Reflect, Uint32Array, Uint8Array};
#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "tasks")]
pub mod outputs_file;
pub mod panic_hook;
#[cfg(feature = "tasks")]
pub mod tasks;

/// Sentinel for a missing value in a `date` column (days since 1970-01-01).
pub const DATE_MISSING: u32 = u32::MAX;

pub enum ColumnData {
    F64(Vec<f64>),
    I32(Vec<i32>),
    U32(Vec<u32>),
    Bool(Vec<bool>),
    Enum {
        indices: Vec<u32>,
        labels: Vec<String>,
    },
    /// Calendar dates as days since 1970-01-01; [`DATE_MISSING`] for none.
    Date(Vec<u32>),
}

impl ColumnData {
    /// The wire type name shared with the browser-side `ColumnDescriptor`.
    pub fn type_name(&self) -> &'static str {
        match self {
            ColumnData::F64(_) => "f64",
            ColumnData::I32(_) => "i32",
            ColumnData::U32(_) => "u32",
            ColumnData::Bool(_) => "bool",
            ColumnData::Enum { .. } => "enum",
            ColumnData::Date(_) => "date",
        }
    }

    pub fn len(&self) -> usize {
        match self {
            ColumnData::F64(v) => v.len(),
            ColumnData::I32(v) => v.len(),
            ColumnData::U32(v) => v.len(),
            ColumnData::Bool(v) => v.len(),
            ColumnData::Enum { indices, .. } => indices.len(),
            ColumnData::Date(v) => v.len(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

pub struct ModelOutput {
    length: usize,
    columns: Vec<(String, ColumnData)>,
}

impl ModelOutput {
    pub fn new(length: usize) -> Self {
        Self {
            length,
            columns: Vec::new(),
        }
    }

    pub fn len(&self) -> usize {
        self.length
    }

    pub fn is_empty(&self) -> bool {
        self.length == 0
    }

    pub fn columns(&self) -> &[(String, ColumnData)] {
        &self.columns
    }

    /// Column names and wire types, the part of a table that should stay fixed
    /// across emits (enum labels may grow).
    pub fn schema(&self) -> Vec<(&str, &'static str)> {
        self.columns
            .iter()
            .map(|(n, c)| (n.as_str(), c.type_name()))
            .collect()
    }

    pub fn add_f64(mut self, name: &str, data: Vec<f64>) -> Self {
        self.columns.push((name.to_string(), ColumnData::F64(data)));
        self
    }

    pub fn add_i32(mut self, name: &str, data: Vec<i32>) -> Self {
        self.columns.push((name.to_string(), ColumnData::I32(data)));
        self
    }

    pub fn add_u32(mut self, name: &str, data: Vec<u32>) -> Self {
        self.columns.push((name.to_string(), ColumnData::U32(data)));
        self
    }

    pub fn add_bool(mut self, name: &str, data: Vec<bool>) -> Self {
        self.columns
            .push((name.to_string(), ColumnData::Bool(data)));
        self
    }

    pub fn add_enum(mut self, name: &str, indices: Vec<u32>, labels: Vec<&str>) -> Self {
        self.columns.push((
            name.to_string(),
            ColumnData::Enum {
                indices,
                labels: labels.into_iter().map(|s| s.to_string()).collect(),
            },
        ));
        self
    }

    /// A date column of days since 1970-01-01 (`DATE_MISSING` for none).
    pub fn add_date(mut self, name: &str, days: Vec<u32>) -> Self {
        self.columns
            .push((name.to_string(), ColumnData::Date(days)));
        self
    }

    #[cfg(feature = "wasm")]
    pub fn into_js(self) -> JsValue {
        let obj = Object::new();
        Reflect::set(&obj, &"__modelOutput".into(), &true.into()).unwrap();
        Reflect::set(&obj, &"length".into(), &(self.length as f64).into()).unwrap();

        let cols = Array::new();
        let bufs = Array::new();

        for (name, data) in self.columns {
            let desc = Object::new();
            Reflect::set(&desc, &"name".into(), &name.into()).unwrap();
            Reflect::set(&desc, &"type".into(), &data.type_name().into()).unwrap();

            match data {
                ColumnData::F64(v) => {
                    let arr = Float64Array::from(v.as_slice());
                    bufs.push(&arr.buffer());
                }
                ColumnData::I32(v) => {
                    let arr = Int32Array::from(v.as_slice());
                    bufs.push(&arr.buffer());
                }
                ColumnData::U32(v) | ColumnData::Date(v) => {
                    let arr = Uint32Array::from(v.as_slice());
                    bufs.push(&arr.buffer());
                }
                ColumnData::Bool(v) => {
                    let bytes: Vec<u8> = v.iter().map(|b| if *b { 1 } else { 0 }).collect();
                    let arr = Uint8Array::from(bytes.as_slice());
                    bufs.push(&arr.buffer());
                }
                ColumnData::Enum { indices, labels } => {
                    let labels_arr = Array::new();
                    for l in &labels {
                        labels_arr.push(&JsValue::from_str(l));
                    }
                    Reflect::set(&desc, &"enumLabels".into(), &labels_arr).unwrap();
                    let arr = Uint32Array::from(indices.as_slice());
                    bufs.push(&arr.buffer());
                }
            }
            cols.push(&desc);
        }

        Reflect::set(&obj, &"columns".into(), &cols).unwrap();
        Reflect::set(&obj, &"buffers".into(), &bufs).unwrap();
        obj.into()
    }
}

/// Named tables: what a model run produces.
#[derive(Default)]
pub struct Outputs {
    tables: Vec<(String, ModelOutput)>,
}

impl Outputs {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(mut self, name: &str, output: ModelOutput) -> Self {
        self.tables.push((name.to_string(), output));
        self
    }

    /// Take `other`'s tables: one with a name already here replaces it in
    /// place, the rest are appended in order. Returns the names of replaced
    /// tables whose [`ModelOutput::schema`] changed.
    pub fn merge(&mut self, other: Outputs) -> Vec<String> {
        let mut changed = Vec::new();
        for (name, output) in other.tables {
            match self.tables.iter_mut().find(|(n, _)| *n == name) {
                Some(slot) => {
                    if slot.1.schema() != output.schema() {
                        changed.push(name);
                    }
                    slot.1 = output;
                }
                None => self.tables.push((name, output)),
            }
        }
        changed
    }

    pub fn clear(&mut self) {
        self.tables.clear();
    }

    pub fn tables(&self) -> &[(String, ModelOutput)] {
        &self.tables
    }

    pub fn names(&self) -> Vec<&str> {
        self.tables.iter().map(|(n, _)| n.as_str()).collect()
    }

    pub fn is_empty(&self) -> bool {
        self.tables.is_empty()
    }

    #[cfg(feature = "wasm")]
    pub fn into_js(self) -> JsValue {
        let obj = Object::new();
        Reflect::set(&obj, &"__modelOutputs".into(), &true.into()).unwrap();
        let outputs = Object::new();
        for (name, output) in self.tables {
            Reflect::set(&outputs, &name.into(), &output.into_js()).unwrap();
        }
        Reflect::set(&obj, &"outputs".into(), &outputs).unwrap();
        obj.into()
    }
}

impl<const N: usize> From<[(&str, ModelOutput); N]> for Outputs {
    fn from(pairs: [(&str, ModelOutput); N]) -> Self {
        let mut outputs = Outputs::new();
        for (name, output) in pairs {
            outputs = outputs.add(name, output);
        }
        outputs
    }
}

/// Create a multi-output result from named ModelOutput pairs.
#[cfg(feature = "wasm")]
pub fn model_outputs<const N: usize>(pairs: [(&str, ModelOutput); N]) -> JsValue {
    Outputs::from(pairs).into_js()
}

use js_sys::{Array, Float64Array, Int32Array, Object, Reflect, Uint32Array, Uint8Array};
use wasm_bindgen::prelude::*;

pub enum ColumnData {
    F64(Vec<f64>),
    I32(Vec<i32>),
    U32(Vec<u32>),
    Bool(Vec<bool>),
    Enum {
        indices: Vec<u32>,
        labels: Vec<String>,
    },
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

    pub fn add_f64(mut self, name: &str, data: Vec<f64>) -> Self {
        self.columns
            .push((name.to_string(), ColumnData::F64(data)));
        self
    }

    pub fn add_i32(mut self, name: &str, data: Vec<i32>) -> Self {
        self.columns
            .push((name.to_string(), ColumnData::I32(data)));
        self
    }

    pub fn add_u32(mut self, name: &str, data: Vec<u32>) -> Self {
        self.columns
            .push((name.to_string(), ColumnData::U32(data)));
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

    pub fn into_js(self) -> JsValue {
        let obj = Object::new();
        Reflect::set(&obj, &"__modelOutput".into(), &true.into()).unwrap();
        Reflect::set(&obj, &"length".into(), &(self.length as f64).into()).unwrap();

        let cols = Array::new();
        let bufs = Array::new();

        for (name, data) in self.columns {
            let desc = Object::new();
            Reflect::set(&desc, &"name".into(), &name.into()).unwrap();

            match data {
                ColumnData::F64(v) => {
                    Reflect::set(&desc, &"type".into(), &"f64".into()).unwrap();
                    let arr = Float64Array::from(v.as_slice());
                    bufs.push(&arr.buffer());
                }
                ColumnData::I32(v) => {
                    Reflect::set(&desc, &"type".into(), &"i32".into()).unwrap();
                    let arr = Int32Array::from(v.as_slice());
                    bufs.push(&arr.buffer());
                }
                ColumnData::U32(v) => {
                    Reflect::set(&desc, &"type".into(), &"u32".into()).unwrap();
                    let arr = Uint32Array::from(v.as_slice());
                    bufs.push(&arr.buffer());
                }
                ColumnData::Bool(v) => {
                    Reflect::set(&desc, &"type".into(), &"bool".into()).unwrap();
                    let bytes: Vec<u8> = v.iter().map(|b| if *b { 1 } else { 0 }).collect();
                    let arr = Uint8Array::from(bytes.as_slice());
                    bufs.push(&arr.buffer());
                }
                ColumnData::Enum { indices, labels } => {
                    Reflect::set(&desc, &"type".into(), &"enum".into()).unwrap();
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

/// Create a multi-output result from named ModelOutput pairs.
pub fn model_outputs<const N: usize>(pairs: [(&str, ModelOutput); N]) -> JsValue {
    let obj = Object::new();
    Reflect::set(&obj, &"__modelOutputs".into(), &true.into()).unwrap();

    let outputs = Object::new();
    for (name, output) in pairs {
        Reflect::set(&outputs, &name.into(), &output.into_js()).unwrap();
    }
    Reflect::set(&obj, &"outputs".into(), &outputs).unwrap();

    obj.into()
}

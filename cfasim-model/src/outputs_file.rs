//! Writer for the `.cfasim` outputs file.
//!
//! Layout (all integers little-endian):
//!
//! ```text
//! [0, 4)               u32 header length
//! [4, 4 + len)         UTF-8 JSON header, space-padded so the data section
//!                      starts on an 8-byte boundary
//! [4 + len, ...)       column buffers in column order, each padded to 8 bytes
//! ```
//!
//! The header is `{"version":1,"outputs":{name:{"length","columns",
//! "byteOffsets","byteLengths"}}}` with the same `ColumnDescriptor` list the
//! browser-side `ModelOutput` uses. Byte-for-byte compatible with the Python
//! writer in `cfasim_model.outputs_file`.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Serialize, Serializer};

use crate::{ColumnData, ModelOutput, Outputs, DATE_MISSING};

pub const FORMAT_VERSION: u32 = 1;
const ALIGN: usize = 8;

fn pad(n: usize) -> usize {
    (ALIGN - n % ALIGN) % ALIGN
}

fn column_bytes(data: &ColumnData) -> Vec<u8> {
    match data {
        ColumnData::F64(v) => v.iter().flat_map(|x| x.to_le_bytes()).collect(),
        ColumnData::I32(v) => v.iter().flat_map(|x| x.to_le_bytes()).collect(),
        ColumnData::U32(v) | ColumnData::Date(v) => {
            v.iter().flat_map(|x| x.to_le_bytes()).collect()
        }
        ColumnData::Bool(v) => v.iter().map(|b| u8::from(*b)).collect(),
        ColumnData::Enum { indices, .. } => indices.iter().flat_map(|x| x.to_le_bytes()).collect(),
    }
}

#[derive(Serialize)]
struct ColumnDescriptor<'a> {
    name: &'a str,
    #[serde(rename = "type")]
    ty: &'static str,
    #[serde(rename = "enumLabels", skip_serializing_if = "Option::is_none")]
    enum_labels: Option<&'a Vec<String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TableHeader<'a> {
    length: usize,
    columns: Vec<ColumnDescriptor<'a>>,
    byte_offsets: Vec<usize>,
    byte_lengths: Vec<usize>,
}

/// Tables in insertion order (a `serde_json::Map` would sort them).
struct Tables<'a>(Vec<(&'a str, TableHeader<'a>)>);

impl Serialize for Tables<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_map(self.0.iter().map(|(name, table)| (name, table)))
    }
}

#[derive(Serialize)]
struct Header<'a> {
    version: u32,
    outputs: Tables<'a>,
}

/// Encode the outputs as a `.cfasim` file image.
///
/// Fails when a column's length does not match its table's declared length.
pub fn encode_outputs(outputs: &Outputs) -> io::Result<Vec<u8>> {
    let mut tables = Vec::new();
    let mut buffers: Vec<Vec<u8>> = Vec::new();
    let mut offset = 0usize;
    for (name, output) in outputs.tables() {
        let mut offsets = Vec::new();
        let mut lengths = Vec::new();
        for (col, data) in output.columns() {
            if data.len() != output.len() {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!(
                        "column {col:?} of {name:?} has {} rows but the output declares {}",
                        data.len(),
                        output.len()
                    ),
                ));
            }
            let bytes = column_bytes(data);
            offsets.push(offset);
            lengths.push(bytes.len());
            offset += bytes.len() + pad(bytes.len());
            buffers.push(bytes);
        }
        let columns = output
            .columns()
            .iter()
            .map(|(name, data)| ColumnDescriptor {
                name,
                ty: data.type_name(),
                enum_labels: match data {
                    ColumnData::Enum { labels, .. } => Some(labels),
                    _ => None,
                },
            })
            .collect();
        tables.push((
            name.as_str(),
            TableHeader {
                length: output.len(),
                columns,
                byte_offsets: offsets,
                byte_lengths: lengths,
            },
        ));
    }
    let header = Header {
        version: FORMAT_VERSION,
        outputs: Tables(tables),
    };
    let mut header = serde_json::to_vec(&header).map_err(io::Error::other)?;
    header.resize(header.len() + pad(4 + header.len()), b' ');

    let mut out = Vec::with_capacity(4 + header.len() + offset);
    out.extend_from_slice(&(header.len() as u32).to_le_bytes());
    out.extend_from_slice(&header);
    for bytes in &buffers {
        out.extend_from_slice(bytes);
        out.resize(out.len() + pad(bytes.len()), 0);
    }
    Ok(out)
}

/// Encode and write atomically (temp file in the same directory, then rename).
pub fn write_outputs(path: &Path, outputs: &Outputs) -> io::Result<()> {
    let bytes = encode_outputs(outputs)?;
    let tmp = tmp_path(path);
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, path)
}

fn tmp_path(path: &Path) -> PathBuf {
    let mut name = path
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_default();
    name.push(".tmp");
    path.with_file_name(name)
}

/// Days since 1970-01-01 as `YYYY-MM-DD` (proleptic Gregorian).
pub fn format_epoch_days(days: u32) -> String {
    let z = i64::from(days) + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{y:04}-{m:02}-{d:02}")
}

fn csv_field(text: &str) -> String {
    if text.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", text.replace('"', "\"\""))
    } else {
        text.to_string()
    }
}

/// Render one table as CSV with enum labels and ISO dates resolved.
pub fn output_to_csv(output: &ModelOutput) -> String {
    let columns = output.columns();
    let mut text = String::new();
    let header: Vec<String> = columns.iter().map(|(name, _)| csv_field(name)).collect();
    text.push_str(&header.join(","));
    text.push('\n');
    for row in 0..output.len() {
        let fields: Vec<String> = columns
            .iter()
            .map(|(_, data)| match data {
                ColumnData::F64(v) => format!("{:?}", v[row]),
                ColumnData::I32(v) => v[row].to_string(),
                ColumnData::U32(v) => v[row].to_string(),
                ColumnData::Bool(v) => if v[row] { "true" } else { "false" }.to_string(),
                ColumnData::Enum { indices, labels } => csv_field(
                    labels
                        .get(indices[row] as usize)
                        .map(String::as_str)
                        .unwrap_or(""),
                ),
                ColumnData::Date(v) => {
                    if v[row] == DATE_MISSING {
                        String::new()
                    } else {
                        format_epoch_days(v[row])
                    }
                }
            })
            .collect();
        text.push_str(&fields.join(","));
        text.push('\n');
    }
    text
}

/// Write `<name>.csv` for every table; returns the paths written.
pub fn write_csvs(dir: &Path, outputs: &Outputs) -> io::Result<Vec<PathBuf>> {
    let mut written = Vec::new();
    for (name, output) in outputs.tables() {
        let path = dir.join(format!("{name}.csv"));
        fs::write(&path, output_to_csv(output))?;
        written.push(path);
    }
    Ok(written)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The same tables `cfasim-model-py/tests/make_fixtures.py` writes.
    fn sample_outputs() -> Outputs {
        let series = ModelOutput::new(3)
            .add_f64("time", vec![0.0, 0.5, 1.0])
            .add_i32("delta", vec![-1, 0, 1])
            .add_u32("count", vec![0, 10, 20])
            .add_bool("flag", vec![true, false, true])
            .add_enum("status", vec![0, 2, 1], vec!["S", "I", "R"])
            .add_date("when", vec![20458, 20465, DATE_MISSING]);
        let empty = ModelOutput::new(0).add_f64("nothing", vec![]);
        Outputs::new().add("series", series).add("empty", empty)
    }

    #[test]
    fn matches_the_shared_fixture_byte_for_byte() {
        let fixture = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../cfasim-model-py/tests/fixtures/sample.cfasim"
        );
        let expected = fs::read(fixture).unwrap();
        assert_eq!(encode_outputs(&sample_outputs()).unwrap(), expected);
    }

    #[test]
    fn rejects_mismatched_column_length() {
        let bad = Outputs::new().add("t", ModelOutput::new(2).add_f64("x", vec![1.0]));
        assert!(encode_outputs(&bad).is_err());
    }

    #[test]
    fn write_is_atomic_and_leaves_no_tmp() {
        let dir = std::env::temp_dir().join(format!("cfasim-outputs-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("outputs.cfasim");
        write_outputs(&path, &sample_outputs()).unwrap();
        assert!(path.is_file());
        assert!(!tmp_path(&path).exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn csv_resolves_labels_dates_and_bools() {
        let outputs = sample_outputs();
        let csv = output_to_csv(&outputs.tables()[0].1);
        assert_eq!(
            csv,
            "time,delta,count,flag,status,when\n\
             0.0,-1,0,true,S,2026-01-05\n\
             0.5,0,10,false,R,2026-01-12\n\
             1.0,1,20,true,I,\n"
        );
    }

    #[test]
    fn epoch_days_format() {
        assert_eq!(format_epoch_days(0), "1970-01-01");
        assert_eq!(format_epoch_days(20458), "2026-01-05");
        assert_eq!(format_epoch_days(11016), "2000-02-29");
    }
}

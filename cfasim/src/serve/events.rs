//! Run events shared by the worker reader, the manager, and the SSE encoder.

use chrono::{DateTime, Local, SecondsFormat};
use serde_json::{Map, Value};

pub type Event = Map<String, Value>;

pub const STATUS: &str = "status";
pub const PROGRESS: &str = "progress";
pub const LOG: &str = "log";
pub const OUTPUTS: &str = "outputs";
pub const DONE: &str = "done";
pub const ERROR: &str = "error";
pub const CANCELLED: &str = "cancelled";

// Worker lifecycle messages; never forwarded to clients.
pub const WORKER_READY: &str = "worker_ready";
pub const WORKER_EXITED: &str = "worker_exited";

/// Version of the worker protocol this server speaks, as `major.minor`.
/// Workers report theirs in `worker_ready`; only a major bump breaks compatibility.
pub const PROTOCOL: &str = "1.0";

fn protocol_major(version: &str) -> Option<&str> {
    version.split('.').next().filter(|m| !m.is_empty())
}

/// A warning when the worker's reported protocol version is missing or has a
/// different major than [`PROTOCOL`]; `None` when the two are compatible.
pub fn protocol_warning(worker: Option<&str>) -> Option<String> {
    let server_major = protocol_major(PROTOCOL)?;
    match worker {
        None => Some(format!(
            "worker did not report a protocol version; this server speaks {PROTOCOL}. \
             Update cfasim-model (Python) or the cfasim-model crate (Rust) to match cfasim"
        )),
        Some(v) if protocol_major(v) != Some(server_major) => Some(format!(
            "worker speaks protocol {v} but this server speaks {PROTOCOL}; \
             update cfasim and cfasim-model to matching versions"
        )),
        Some(_) => None,
    }
}

pub fn is_terminal(type_: &str) -> bool {
    matches!(type_, DONE | ERROR | CANCELLED)
}

/// Local time with its offset, the form of every timestamp in status.json.
pub fn iso(time: DateTime<Local>) -> String {
    time.to_rfc3339_opts(SecondsFormat::Millis, false)
}

pub fn now_iso() -> String {
    iso(Local::now())
}

pub fn make_event(type_: &str, run_id: Option<&str>, fields: Value) -> Event {
    let mut event = Event::new();
    event.insert("type".into(), type_.into());
    event.insert("run_id".into(), run_id.map_or(Value::Null, Into::into));
    event.insert("time".into(), now_iso().into());
    if let Value::Object(extra) = fields {
        event.extend(extra);
    }
    event
}

pub fn event_type(event: &Event) -> &str {
    event.get("type").and_then(Value::as_str).unwrap_or("")
}

pub fn event_str<'a>(event: &'a Event, key: &str) -> Option<&'a str> {
    event.get(key).and_then(Value::as_str)
}

pub fn event_seq(event: &Event) -> u64 {
    event.get("seq").and_then(Value::as_u64).unwrap_or(0)
}

/// One SSE frame: `seq` becomes the frame id so `Last-Event-ID` can resume.
pub fn sse_frame(event: &Event) -> axum::response::sse::Event {
    let mut frame = axum::response::sse::Event::default()
        .event(event_type(event))
        .data(Value::Object(event.clone()).to_string());
    if let Some(seq) = event.get("seq").and_then(Value::as_u64) {
        frame = frame.id(seq.to_string());
    }
    frame
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn make_event_has_the_shared_fields() {
        let e = make_event(PROGRESS, Some("r1"), json!({ "fraction": 0.5 }));
        assert_eq!(event_type(&e), "progress");
        assert_eq!(event_str(&e, "run_id"), Some("r1"));
        assert_eq!(e["fraction"], 0.5);
        let time = event_str(&e, "time").unwrap();
        assert!(
            time.len() >= 29 && (time.ends_with("Z") || time[time.len() - 6..].contains(':')),
            "{time}"
        );
    }

    #[test]
    fn protocol_warns_only_on_a_major_change() {
        assert_eq!(protocol_warning(Some(PROTOCOL)), None);
        assert_eq!(protocol_warning(Some("1.7")), None);
        assert!(protocol_warning(None).unwrap().contains("did not report"));
        assert!(protocol_warning(Some("2.0"))
            .unwrap()
            .contains("protocol 2.0 but this server speaks 1.0"));
        assert!(protocol_warning(Some("0.9")).is_some());
    }
}

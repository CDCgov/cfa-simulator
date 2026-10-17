//! The HTTP + Server-Sent Events surface over a [`Manager`], the protocol
//! documented on `docs/cfasim-ui/server.md`.

use std::collections::HashMap;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use axum::body::{Body, Bytes};
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::sse::{KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{json, Value};
use tokio_stream::wrappers::UnboundedReceiverStream;
use tokio_stream::{Stream, StreamExt};
use tokio_util::io::ReaderStream;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};

use super::events::{event_seq, sse_frame};
use super::manager::{CancelError, Manager};
use super::runs::{LOG_FILENAME, OUTPUTS_FILENAME};

const TASKS_WAIT: Duration = Duration::from_secs(10);
const PING_INTERVAL: Duration = Duration::from_secs(15);

type App = State<Arc<Manager>>;

fn error(message: impl Into<String>, status: StatusCode) -> Response {
    (status, Json(json!({ "error": message.into() }))).into_response()
}

/// An error reply that handlers can return with `?`.
struct ApiError(StatusCode, String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        error(self.1, self.0)
    }
}

type Reply = Result<Response, ApiError>;

fn unknown_run(run_id: &str) -> ApiError {
    ApiError(StatusCode::NOT_FOUND, format!("unknown run {run_id:?}"))
}

/// The run's directory, or a 404 when it has no status document.
fn require_run(manager: &Manager, run_id: &str) -> Result<PathBuf, ApiError> {
    manager
        .store
        .run_dir(run_id)
        .filter(|_| manager.store.exists(run_id))
        .ok_or_else(|| unknown_run(run_id))
}

async fn health(State(m): App) -> Response {
    let mut doc = json!({ "ok": true, "version": env!("CARGO_PKG_VERSION") });
    if let (Value::Object(doc), Value::Object(health)) = (&mut doc, m.health()) {
        doc.extend(health);
    }
    Json(doc).into_response()
}

async fn list_tasks(State(m): App) -> Response {
    if !m.ready() {
        // The worker learns the task list by importing the user module; give
        // a fresh server a moment rather than answering with nothing.
        m.wait_ready(TASKS_WAIT).await;
    }
    Json(json!({ "tasks": m.tasks(), "ready": m.ready(), "error": m.worker_error() }))
        .into_response()
}

async fn start_run(State(m): App, Path(name): Path<String>, body: Bytes) -> Response {
    if !m.ready() && !m.wait_ready(TASKS_WAIT).await {
        let detail = m
            .worker_error()
            .unwrap_or_else(|| "the worker is still starting".into());
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            [(header::RETRY_AFTER, "2")],
            Json(json!({ "error": detail })),
        )
            .into_response();
    }
    let Some(task) = m.task(&name) else {
        return error(format!("unknown task {name:?}"), StatusCode::NOT_FOUND);
    };
    let body: Value = if body.is_empty() {
        json!({})
    } else {
        match serde_json::from_slice(&body) {
            Ok(v) => v,
            Err(_) => return error("request body must be JSON", StatusCode::BAD_REQUEST),
        }
    };
    let inputs = match &body {
        Value::Object(map) => map.get("inputs").cloned().unwrap_or_else(|| json!({})),
        _ => Value::Null,
    };
    if !inputs.is_object() {
        return error(
            r#"request body must be {"inputs": {...}}"#,
            StatusCode::BAD_REQUEST,
        );
    }
    let run_name = match body.get("name") {
        None | Some(Value::Null) => None,
        Some(Value::String(s)) => Some(s.clone()),
        Some(_) => return error("name must be a string", StatusCode::BAD_REQUEST),
    };
    if let Err(message) = task.validate(&inputs) {
        return error(message, StatusCode::BAD_REQUEST);
    }
    match m.submit(&task, &inputs, run_name.as_deref()) {
        Ok(status) => (
            StatusCode::ACCEPTED,
            Json(json!({
                "run_id": status.get("run_id"),
                "name": status.get("name"),
                "inputs_hash": status.get("inputs_hash"),
                "status": status.get("status"),
            })),
        )
            .into_response(),
        Err(e) => error(
            format!("could not create the run directory: {e}"),
            StatusCode::INTERNAL_SERVER_ERROR,
        ),
    }
}

async fn list_runs(State(m): App, Query(q): Query<HashMap<String, String>>) -> Response {
    let limit = match q.get("limit").map(|l| l.parse::<usize>()) {
        None => 50,
        Some(Ok(n)) => n,
        Some(Err(_)) => return error("limit must be an integer", StatusCode::BAD_REQUEST),
    };
    Json(json!({ "runs": m.store.list_runs(q.get("task").map(String::as_str), limit) }))
        .into_response()
}

async fn get_run(State(m): App, Path(run_id): Path<String>) -> Reply {
    let status = m
        .store
        .read_status(&run_id)
        .ok_or_else(|| unknown_run(&run_id))?;
    Ok(Json(Value::Object(status)).into_response())
}

async fn get_inputs(State(m): App, Path(run_id): Path<String>) -> Reply {
    require_run(&m, &run_id)?;
    Ok(Json(m.store.read_inputs(&run_id).unwrap_or_else(|| json!({}))).into_response())
}

async fn get_log(
    State(m): App,
    Path(run_id): Path<String>,
    Query(q): Query<HashMap<String, String>>,
) -> Reply {
    let dir = require_run(&m, &run_id)?;
    let text = tokio::fs::read_to_string(dir.join(LOG_FILENAME))
        .await
        .unwrap_or_default();
    let text = match q.get("tail").map(|t| t.parse::<usize>()) {
        None => text,
        Some(Err(_)) => {
            return Err(ApiError(
                StatusCode::BAD_REQUEST,
                "tail must be an integer".into(),
            ))
        }
        Some(Ok(n)) => {
            let lines: Vec<&str> = text.lines().collect();
            let start = lines.len().saturating_sub(n);
            let mut tail = lines[start..].join("\n");
            if !text.is_empty() {
                tail.push('\n');
            }
            tail
        }
    };
    Ok(([(header::CONTENT_TYPE, "text/plain; charset=utf-8")], text).into_response())
}

async fn file_response(path: PathBuf, media_type: &str, missing: &str) -> Response {
    match tokio::fs::File::open(&path).await {
        Ok(file) => (
            [
                (header::CONTENT_TYPE, media_type.to_string()),
                (header::CACHE_CONTROL, "no-store".to_string()),
            ],
            Body::from_stream(ReaderStream::new(file)),
        )
            .into_response(),
        Err(_) => error(missing, StatusCode::NOT_FOUND),
    }
}

async fn get_outputs(State(m): App, Path(run_id): Path<String>) -> Reply {
    let dir = require_run(&m, &run_id)?;
    Ok(file_response(
        dir.join(OUTPUTS_FILENAME),
        "application/octet-stream",
        "this run has not produced outputs yet",
    )
    .await)
}

async fn list_files(State(m): App, Path(run_id): Path<String>) -> Reply {
    require_run(&m, &run_id)?;
    Ok(Json(json!({ "files": m.store.list_files(&run_id) })).into_response())
}

async fn get_file(State(m): App, Path((run_id, rel)): Path<(String, String)>) -> Reply {
    require_run(&m, &run_id)?;
    let Some(path) = m.store.resolve_file(&run_id, &rel) else {
        return Err(ApiError(StatusCode::NOT_FOUND, "file not found".into()));
    };
    let media_type = mime_guess::from_path(&path)
        .first_or_octet_stream()
        .to_string();
    Ok(file_response(path, &media_type, "file not found").await)
}

async fn cancel_run(State(m): App, Path(run_id): Path<String>) -> Response {
    match m.cancel(&run_id) {
        Ok(()) => (
            StatusCode::ACCEPTED,
            Json(json!({ "run_id": run_id, "status": "cancelling" })),
        )
            .into_response(),
        Err(CancelError::Finished(state)) => error(
            format!("run {run_id} already finished ({state})"),
            StatusCode::CONFLICT,
        ),
        Err(CancelError::Unknown) => unknown_run(&run_id).into_response(),
    }
}

type SseItem = Result<axum::response::sse::Event, std::convert::Infallible>;

async fn run_events(State(m): App, Path(run_id): Path<String>, headers: HeaderMap) -> Reply {
    require_run(&m, &run_id)?;
    let after: u64 = headers
        .get("last-event-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);
    let (history, live) = m.subscribe(&run_id);
    let history = tokio_stream::iter(
        history
            .into_iter()
            .filter(move |e| event_seq(e) > after)
            .map(|e| Ok(sse_frame(&e)) as SseItem),
    );
    let live: Pin<Box<dyn Stream<Item = SseItem> + Send>> = match live {
        Some(rx) => {
            Box::pin(UnboundedReceiverStream::new(rx).map_while(|e| e.map(|e| Ok(sse_frame(&e)))))
        }
        None => Box::pin(tokio_stream::empty()),
    };
    Ok(Sse::new(history.chain(live))
        .keep_alive(KeepAlive::new().interval(PING_INTERVAL).text("ping"))
        .into_response())
}

pub fn router(manager: Arc<Manager>, static_dir: Option<PathBuf>, cors: bool) -> Router {
    let api = Router::new()
        .route("/health", get(health))
        .route("/tasks", get(list_tasks))
        .route("/tasks/{name}/run", post(start_run))
        .route("/runs", get(list_runs))
        .route("/runs/{run_id}", get(get_run))
        .route("/runs/{run_id}/events", get(run_events))
        .route("/runs/{run_id}/outputs", get(get_outputs))
        .route("/runs/{run_id}/inputs", get(get_inputs))
        .route("/runs/{run_id}/log", get(get_log))
        .route("/runs/{run_id}/files", get(list_files))
        .route("/runs/{run_id}/files/{*path}", get(get_file))
        .route("/runs/{run_id}/cancel", post(cancel_run))
        .with_state(manager);
    let mut app = Router::new().nest("/api", api);
    if let Some(dir) = static_dir {
        let index = ServeFile::new(dir.join("index.html"));
        app = app.fallback_service(
            ServeDir::new(dir)
                .append_index_html_on_directories(true)
                .not_found_service(index),
        );
    }
    if cors {
        app = app.layer(CorsLayer::permissive());
    }
    app
}

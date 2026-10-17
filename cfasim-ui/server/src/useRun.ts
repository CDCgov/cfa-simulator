import { computed, onScopeDispose, ref, shallowRef, toValue, watch } from "vue";
import type { MaybeRefOrGetter } from "vue";
import type { ModelOutput } from "@cfasim-ui/shared";
import { createApi, errorMessage } from "./api.js";
import type { ServerApi } from "./api.js";
import type {
  LogLine,
  RunFile,
  RunHandle,
  RunProgress,
  RunStatus,
  ServerOptions,
} from "./types.js";
import { TERMINAL_STATUSES } from "./types.js";

const MAX_LOG_LINES = 5000;

const CONNECTION_LOST = "Connection to the server lost, retrying";

// log.txt prefixes every non-stdout line with its stream, e.g. "[stderr] ".
function parseSavedLog(text: string): LogLine[] {
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines.map((line) => {
    const m = /^\[(stderr|task)\] (.*)$/s.exec(line);
    return m
      ? { stream: m[1] as LogLine["stream"], line: m[2] }
      : { stream: "stdout", line };
  });
}

interface LogEvent {
  stream: LogLine["stream"];
  line: string;
  overwrite: boolean;
}

/**
 * Follow one run: its status, progress, log, and outputs, live over
 * Server-Sent Events. Pass a ref to switch runs; pass `undefined` to detach.
 * Two handles on two run ids give side-by-side comparison.
 */
export function useRun(
  runId: MaybeRefOrGetter<string | undefined>,
  options: ServerOptions | { api: ServerApi } = {},
): RunHandle {
  const api = "api" in options ? options.api : createApi(options.baseUrl);

  const id = ref<string>();
  const status = ref<RunStatus>();
  const progress = ref<RunProgress>();
  const log = ref<LogLine[]>([]);
  const outputs = shallowRef<Record<string, ModelOutput>>();
  const revision = ref(0);
  const inputs = ref<Record<string, unknown>>();
  const files = ref<RunFile[]>([]);
  const error = ref<string>();
  const active = computed(
    () => status.value === "queued" || status.value === "running",
  );

  let source: EventSource | undefined;
  // The in-flight `/outputs` fetch; at most one at a time.
  let controller: AbortController | undefined;
  // Highest outputs revision announced by the server.
  let wantedRevision = 0;
  let fetchScheduled = false;
  let outputsError: string | undefined;
  // The stream ended before `seed` knew the status (an old, finished run).
  let streamEnded = false;
  // Index into `log` of the last overwrite line per stream, so progress-bar
  // updates replace rather than append.
  let overwriteIndex: Partial<Record<LogLine["stream"], number>> = {};

  function reset() {
    status.value = undefined;
    progress.value = undefined;
    log.value = [];
    outputs.value = undefined;
    revision.value = 0;
    inputs.value = undefined;
    files.value = [];
    error.value = undefined;
    wantedRevision = 0;
    fetchScheduled = false;
    outputsError = undefined;
    streamEnded = false;
    overwriteIndex = {};
  }

  function closeSource() {
    source?.close();
    source = undefined;
  }

  function teardown() {
    closeSource();
    controller?.abort();
    controller = undefined;
  }

  function finish(next: RunStatus) {
    status.value = next;
    closeSource();
    if (error.value === CONNECTION_LOST) error.value = undefined;
    // Picks up a revision whose fetch failed or is still pending.
    scheduleOutputs();
    void refreshFiles();
  }

  // Loads the saved log when the event stream had none to replay.
  async function loadSavedLog() {
    const current = id.value;
    if (!current || log.value.length) return;
    try {
      const text = await api.fetchLog(current);
      if (id.value !== current || log.value.length) return;
      log.value = parseSavedLog(text).slice(-MAX_LOG_LINES);
    } catch {
      // no log file yet; nothing to show
    }
  }

  async function refreshFiles() {
    const current = id.value;
    if (!current) return;
    try {
      const list = await api.fetchFiles(current);
      if (id.value === current) files.value = list;
    } catch {
      // the run may be gone; keep the previous list
    }
  }

  function requestOutputs(nextRevision: number) {
    if (nextRevision > wantedRevision) wantedRevision = nextRevision;
    scheduleOutputs();
  }

  function scheduleOutputs() {
    if (fetchScheduled || controller || wantedRevision <= revision.value) {
      return;
    }
    fetchScheduled = true;
    // Coalesce a burst of `outputs` events (history replay) into one fetch.
    queueMicrotask(() => {
      fetchScheduled = false;
      const current = id.value;
      const target = wantedRevision;
      if (!current || controller || target <= revision.value) return;
      const ctl = (controller = new AbortController());
      api
        .fetchOutputs(current, ctl.signal)
        .then((decoded) => {
          if (controller !== ctl) return;
          outputs.value = decoded;
          revision.value = target;
          if (error.value === outputsError) error.value = undefined;
          outputsError = undefined;
          controller = undefined;
          // Revisions that arrived meanwhile.
          scheduleOutputs();
        })
        .catch((e: unknown) => {
          if (controller !== ctl) return;
          controller = undefined;
          // The next `outputs` event, or the run finishing, retries.
          outputsError = error.value = errorMessage(e);
        });
    });
  }

  function appendLog(event: LogEvent) {
    const lines = log.value;
    const entry: LogLine = { stream: event.stream, line: event.line };
    const prev = overwriteIndex[event.stream];
    if (event.overwrite && prev !== undefined && lines[prev]) {
      lines[prev] = entry;
      return;
    }
    lines.push(entry);
    if (event.overwrite) {
      overwriteIndex[event.stream] = lines.length - 1;
    } else {
      delete overwriteIndex[event.stream];
    }
    if (lines.length > MAX_LOG_LINES) {
      lines.splice(0, lines.length - MAX_LOG_LINES);
      overwriteIndex = {};
    }
  }

  function subscribe(runId: string) {
    const es = new EventSource(api.eventsUrl(runId));
    source = es;
    const on = <T>(type: string, handler: (data: T) => void) => {
      es.addEventListener(type, (e) => {
        // The browser also dispatches its own connection "error" Event here,
        // which carries no data; `onerror` below handles that one.
        const data = (e as MessageEvent).data as unknown;
        if (source !== es || typeof data !== "string") return;
        handler(JSON.parse(data) as T);
      });
    };
    on<{ status: RunStatus }>("status", (d) => {
      status.value = d.status;
    });
    on<RunProgress>("progress", (d) => {
      progress.value = { fraction: d.fraction, message: d.message ?? null };
    });
    on<LogEvent>("log", appendLog);
    on<{ revision: number }>("outputs", (d) => requestOutputs(d.revision));
    on("done", () => finish("done"));
    on<{ message: string }>("error", (d) => {
      error.value = d.message;
      finish("error");
    });
    on("cancelled", () => finish("cancelled"));
    es.onerror = () => {
      if (source !== es) return;
      // Until `seed` has told us the status, a closed stream may simply be a
      // finished run from an earlier server session; `seed` closes those.
      if (!status.value) {
        streamEnded = true;
        return;
      }
      if (TERMINAL_STATUSES.has(status.value)) {
        closeSource();
        void loadSavedLog();
        return;
      }
      // The browser reconnects on its own; say so until the next event.
      if (!error.value) error.value = CONNECTION_LOST;
    };
    es.onopen = () => {
      if (source !== es) return;
      streamEnded = false;
      if (error.value === CONNECTION_LOST) error.value = undefined;
    };
  }

  async function seed(runId: string) {
    try {
      const [summary, runInputs] = await Promise.all([
        api.getRun(runId),
        api.fetchInputs(runId),
      ]);
      if (id.value !== runId) return;
      // Events may have moved things along while we fetched.
      if (!status.value) status.value = summary.status;
      // A finished run's stream replays its history and then ends, which
      // `onerror` handles; one that already ended had nothing to replay.
      if (TERMINAL_STATUSES.has(status.value) && streamEnded) {
        closeSource();
        void loadSavedLog();
      }
      if (!progress.value && summary.progress)
        progress.value = summary.progress;
      inputs.value = runInputs;
      if (summary.outputs) requestOutputs(summary.outputs.revision);
      if (summary.error && !error.value) error.value = summary.error.message;
    } catch (e: unknown) {
      if (id.value !== runId) return;
      error.value = errorMessage(e);
    }
    void refreshFiles();
  }

  watch(
    () => toValue(runId),
    (next) => {
      teardown();
      reset();
      id.value = next;
      if (!next) return;
      subscribe(next);
      void seed(next);
    },
    { immediate: true },
  );

  onScopeDispose(teardown);

  return {
    id,
    status,
    progress,
    log,
    outputs,
    revision,
    inputs,
    files,
    error,
    active,
    fileUrl: (path: string) => (id.value ? api.fileUrl(id.value, path) : ""),
    refreshFiles,
  };
}

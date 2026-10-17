import { onScopeDispose, ref, watch } from "vue";
import type { MaybeRefOrGetter, Ref } from "vue";
import { ServerError, createApi, errorMessage } from "./api.js";
import { useRun } from "./useRun.js";
import type {
  RunHandle,
  RunSummary,
  ServerOptions,
  TaskInfo,
} from "./types.js";
import { TERMINAL_STATUSES } from "./types.js";

const RECONNECT_INTERVAL_MS = 3000;

const UNREACHABLE = (baseUrl: string) =>
  `Could not reach the cfasim server at ${baseUrl}. Is it running? (In dev, \`pnpm dev\` starts it through the Vite plugin.)`;

export interface ServerModel {
  tasks: Ref<TaskInfo[]>;
  runs: Ref<RunSummary[]>;
  /**
   * `false` while the server cannot be reached; it is retried every few
   * seconds until it answers.
   */
  connected: Ref<boolean>;
  error: Ref<string | undefined>;
  refreshTasks: () => Promise<void>;
  refreshRuns: () => Promise<void>;
  /**
   * Start `task` with `inputs`; the new run becomes `current`. Resolves to
   * its id, or `undefined` when the server refused it (`error` says why). A
   * `name` labels the run and prefixes its id and folder.
   */
  start: (
    task: string,
    inputs: Record<string, unknown>,
    options?: { name?: string },
  ) => Promise<string | undefined>;
  cancel: (runId?: string) => Promise<void>;
  /** Make an existing run `current` (its events replay from the server). */
  load: (runId: string | undefined) => void;
  current: RunHandle;
  /** Follow any other run, e.g. to compare two side by side. */
  useRun: (runId: MaybeRefOrGetter<string | undefined>) => RunHandle;
}

/**
 * Talk to a cfasim task server: list its tasks and saved runs, start and
 * cancel runs, and follow the current one.
 */
export function useServerModel(options: ServerOptions = {}): ServerModel {
  const api = createApi(options.baseUrl);
  const tasks = ref<TaskInfo[]>([]);
  const runs = ref<RunSummary[]>([]);
  const connected = ref(true);
  const error = ref<string>();
  const currentId = ref<string>();
  const current = useRun(currentId, { api });

  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let runsRequest = 0;

  // A network error, or the dev proxy's 502/504 when nothing listens behind it.
  const unreachable = (e: unknown) =>
    e instanceof TypeError ||
    (e instanceof ServerError && (e.status === 502 || e.status === 504));

  function fail(e: unknown) {
    if (unreachable(e)) {
      connected.value = false;
      error.value = UNREACHABLE(api.baseUrl);
      reconnectTimer ??= setTimeout(() => {
        reconnectTimer = undefined;
        void refreshTasks().then(() => {
          if (connected.value) void refreshRuns();
        });
      }, RECONNECT_INTERVAL_MS);
    } else {
      error.value = errorMessage(e);
    }
  }

  async function load<T>(fetchIt: () => Promise<T>, apply: (value: T) => void) {
    try {
      const value = await fetchIt();
      apply(value);
      if (!connected.value) {
        connected.value = true;
        if (error.value === UNREACHABLE(api.baseUrl)) error.value = undefined;
      }
    } catch (e) {
      fail(e);
    }
  }

  const refreshTasks = () =>
    load(api.listTasks, (value) => {
      tasks.value = value;
    });

  function refreshRuns() {
    // Responses can arrive out of order; only the newest request applies.
    const request = ++runsRequest;
    return load(api.listRuns, (value) => {
      if (request === runsRequest) runs.value = value;
    });
  }

  async function start(
    task: string,
    inputs: Record<string, unknown>,
    options: { name?: string } = {},
  ) {
    error.value = undefined;
    const name = options.name?.trim() || undefined;
    try {
      const { run_id } = await api.startRun(task, inputs, name);
      currentId.value = run_id;
      void refreshRuns();
      return run_id;
    } catch (e) {
      fail(e);
      return undefined;
    }
  }

  async function cancel(runId: string | undefined = currentId.value) {
    if (!runId) return;
    try {
      await api.cancelRun(runId);
    } catch (e) {
      fail(e);
    }
  }

  watch(current.status, (next) => {
    if (next && TERMINAL_STATUSES.has(next)) void refreshRuns();
  });

  onScopeDispose(() => clearTimeout(reconnectTimer));

  void refreshTasks();
  void refreshRuns();

  return {
    tasks,
    runs,
    connected,
    error,
    refreshTasks,
    refreshRuns,
    start,
    cancel,
    load: (runId) => {
      currentId.value = runId;
    },
    current,
    useRun: (runId) => useRun(runId, { api }),
  };
}

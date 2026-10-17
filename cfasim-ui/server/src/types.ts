import type { ModelOutput } from "@cfasim-ui/shared";
import type { ComputedRef, Ref } from "vue";

export type RunStatus = "queued" | "running" | "done" | "error" | "cancelled";

export const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set([
  "done",
  "error",
  "cancelled",
]);

export interface RunProgress {
  fraction: number;
  message: string | null;
}

export interface RunError {
  message: string;
  traceback: string | null;
}

/** One run as listed by `GET /api/runs` (the run's `status.json`). */
export interface RunSummary {
  run_id: string;
  /** Optional label given when the run was started; also prefixes `run_id`. */
  name: string | null;
  task: string;
  inputs_hash: string;
  status: RunStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  progress: RunProgress | null;
  outputs: { revision: number; partial: boolean; names: string[] } | null;
  error: RunError | null;
}

export interface TaskParam {
  name: string;
  required: boolean;
  default: unknown;
  annotation: string | null;
}

export interface TaskInfo {
  name: string;
  doc: string | null;
  params: TaskParam[];
  accepts_extra: boolean;
}

/** A file the task wrote into its run directory. */
export interface RunFile {
  path: string;
  size: number;
  modified: string;
}

export interface LogLine {
  stream: "stdout" | "stderr" | "task";
  line: string;
}

export interface ServerOptions {
  /** Prefix of the server's REST routes (default `"/api"`, the Vite proxy path). */
  baseUrl?: string;
}

export interface RunHandle {
  id: Readonly<Ref<string | undefined>>;
  status: Ref<RunStatus | undefined>;
  progress: Ref<RunProgress | undefined>;
  log: Ref<LogLine[]>;
  outputs: Ref<Record<string, ModelOutput> | undefined>;
  /** Revision of `outputs`; increments every time the task emits. */
  revision: Ref<number>;
  inputs: Ref<Record<string, unknown> | undefined>;
  files: Ref<RunFile[]>;
  error: Ref<string | undefined>;
  /** `true` while the run is queued or running. */
  active: ComputedRef<boolean>;
  /** URL of a file the task wrote, for download links; `""` with no run. */
  fileUrl: (path: string) => string;
  refreshFiles: () => Promise<void>;
}

import type { ModelOutput } from "@cfasim-ui/shared";
import { decodeModelOutputs } from "@cfasim-ui/shared";
import type { RunFile, RunSummary, TaskInfo } from "./types.js";

const DEFAULT_BASE_URL = "/api";

interface StartedRun {
  run_id: string;
  name: string | null;
  inputs_hash: string;
}

export class ServerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = "ServerError";
  }
}

export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

async function request(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      // not JSON: keep the status line
    }
    throw new ServerError(detail, res.status, url);
  }
  return res;
}

export function createApi(baseUrl: string = DEFAULT_BASE_URL) {
  const base = baseUrl.replace(/\/$/, "");
  const url = (path: string) => `${base}${path}`;
  const runUrl = (runId: string, suffix = "") =>
    url(`/runs/${encodeURIComponent(runId)}${suffix}`);
  return {
    baseUrl: base,
    eventsUrl: (runId: string) => runUrl(runId, "/events"),
    fileUrl: (runId: string, path: string) =>
      runUrl(
        runId,
        `/files/${path.split("/").map(encodeURIComponent).join("/")}`,
      ),
    async listTasks(): Promise<TaskInfo[]> {
      const res = await request(url("/tasks"));
      return ((await res.json()) as { tasks: TaskInfo[] }).tasks;
    },
    async listRuns(task?: string, limit?: number): Promise<RunSummary[]> {
      const params = new URLSearchParams();
      if (task) params.set("task", task);
      if (limit !== undefined) params.set("limit", String(limit));
      const query = params.toString();
      const res = await request(url(`/runs${query ? `?${query}` : ""}`));
      return ((await res.json()) as { runs: RunSummary[] }).runs;
    },
    async getRun(runId: string): Promise<RunSummary> {
      const res = await request(runUrl(runId));
      return (await res.json()) as RunSummary;
    },
    async startRun(
      task: string,
      inputs: Record<string, unknown>,
      name?: string,
    ): Promise<StartedRun> {
      const res = await request(url(`/tasks/${encodeURIComponent(task)}/run`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(name ? { inputs, name } : { inputs }),
      });
      return (await res.json()) as StartedRun;
    },
    async cancelRun(runId: string): Promise<void> {
      await request(runUrl(runId, "/cancel"), {
        method: "POST",
      });
    },
    async fetchInputs(runId: string): Promise<Record<string, unknown>> {
      const res = await request(runUrl(runId, "/inputs"));
      return (await res.json()) as Record<string, unknown>;
    },
    async fetchLog(runId: string): Promise<string> {
      const res = await request(runUrl(runId, "/log"));
      return res.text();
    },
    async fetchFiles(runId: string): Promise<RunFile[]> {
      const res = await request(runUrl(runId, "/files"));
      return ((await res.json()) as { files: RunFile[] }).files;
    },
    async fetchOutputs(
      runId: string,
      signal?: AbortSignal,
    ): Promise<Record<string, ModelOutput>> {
      const res = await request(runUrl(runId, "/outputs"), { signal });
      return decodeModelOutputs(await res.arrayBuffer());
    },
  };
}

export type ServerApi = ReturnType<typeof createApi>;

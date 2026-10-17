import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useRun } from "./useRun.js";
import {
  FIXTURE_OUTPUTS,
  FakeEventSource,
  flush,
  stubFetch,
  summary,
} from "./testUtils.js";
import type { RouteTable } from "./testUtils.js";

const routes = () => ({
  "GET /api/runs/r1": summary({ progress: { fraction: 0.2, message: "warm" } }),
  "GET /api/runs/r1/inputs": { n: 3 },
  "GET /api/runs/r1/files": {
    files: [{ path: "a.csv", size: 1, modified: "t" }],
  },
  "GET /api/runs/r1/outputs": FIXTURE_OUTPUTS,
  "GET /api/runs/r2": summary({ run_id: "r2", status: "done" }),
  "GET /api/runs/r2/inputs": {},
  "GET /api/runs/r2/files": { files: [] },
  "GET /api/runs/r2/outputs": FIXTURE_OUTPUTS,
});

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mount(id = ref<string | undefined>("r1")) {
  const scope = effectScope();
  const run = scope.run(() => useRun(id))!;
  return { scope, run, id };
}

describe("useRun", () => {
  it("seeds from the run summary and opens an event stream", async () => {
    const { calls } = stubFetch(routes());
    const { run, scope } = mount();
    expect(FakeEventSource.last().url).toBe("/api/runs/r1/events");
    await flush();
    expect(run.status.value).toBe("running");
    expect(run.progress.value).toEqual({ fraction: 0.2, message: "warm" });
    expect(run.inputs.value).toEqual({ n: 3 });
    expect(run.files.value.map((f) => f.path)).toEqual(["a.csv"]);
    expect(run.active.value).toBe(true);
    expect(run.fileUrl("sub/a b.csv")).toBe("/api/runs/r1/files/sub/a%20b.csv");
    expect(calls.some((c) => c.url === "/api/runs/r1/outputs")).toBe(false);
    scope.stop();
    expect(FakeEventSource.last().close).toHaveBeenCalled();
  });

  it("applies progress, log, and terminal events", async () => {
    stubFetch(routes());
    const { run } = mount();
    const es = FakeEventSource.last();
    es.emit("status", { status: "running" });
    es.emit("progress", { fraction: 0.5, message: "half" });
    es.emit("log", { stream: "stdout", line: "hello", overwrite: false });
    es.emit("log", { stream: "stderr", line: "10%", overwrite: true });
    es.emit("log", { stream: "stderr", line: "20%", overwrite: true });
    es.emit("log", { stream: "stderr", line: "100%", overwrite: false });
    expect(run.progress.value).toEqual({ fraction: 0.5, message: "half" });
    expect(run.log.value.map((l) => l.line)).toEqual(["hello", "20%", "100%"]);
    es.emit("done", {});
    await flush();
    expect(run.status.value).toBe("done");
    expect(run.active.value).toBe(false);
    expect(es.close).toHaveBeenCalled();
  });

  it("records error events and closes", async () => {
    stubFetch(routes());
    const { run } = mount();
    const es = FakeEventSource.last();
    es.emit("error", { message: "RuntimeError: kaboom", traceback: "..." });
    expect(run.status.value).toBe("error");
    expect(run.error.value).toBe("RuntimeError: kaboom");
    expect(es.close).toHaveBeenCalled();
    es.emit("cancelled", {});
  });

  it("fetches outputs once for a burst of revisions and ignores stale ones", async () => {
    const { calls } = stubFetch(routes());
    const { run } = mount();
    await flush();
    const es = FakeEventSource.last();
    es.emit("outputs", { revision: 1, partial: true, names: ["series"] });
    es.emit("outputs", { revision: 2, partial: true, names: ["series"] });
    es.emit("outputs", { revision: 3, partial: false, names: ["series"] });
    await flush();
    await flush();
    const outputFetches = calls.filter((c) => c.url === "/api/runs/r1/outputs");
    expect(outputFetches).toHaveLength(1);
    expect(run.revision.value).toBe(3);
    expect(Array.from(run.outputs.value!.series.column("time"))).toEqual([
      0, 0.5, 1,
    ]);
    es.emit("outputs", { revision: 2, partial: true, names: ["series"] });
    await flush();
    expect(calls.filter((c) => c.url === "/api/runs/r1/outputs")).toHaveLength(
      1,
    );
  });

  it("requests outputs recorded in the summary of a finished run", async () => {
    const r = routes();
    r["GET /api/runs/r2"] = summary({
      run_id: "r2",
      status: "done",
      outputs: { revision: 1, partial: false, names: ["series"] },
    });
    const { calls } = stubFetch(r);
    const { run } = mount(ref("r2"));
    await flush();
    await flush();
    expect(run.status.value).toBe("done");
    expect(calls.some((c) => c.url === "/api/runs/r2/outputs")).toBe(true);
    expect(run.outputs.value?.series.length).toBe(3);
  });

  it("switches runs: tears down the old stream and resets state", async () => {
    stubFetch(routes());
    const { run, id } = mount();
    const first = FakeEventSource.last();
    first.emit("progress", { fraction: 0.9, message: null });
    id.value = "r2";
    await nextTick();
    expect(first.close).toHaveBeenCalled();
    expect(run.progress.value).toBeUndefined();
    expect(run.id.value).toBe("r2");
    expect(FakeEventSource.last().url).toBe("/api/runs/r2/events");
    // Late events from the old source are ignored.
    first.emit("progress", { fraction: 0.95, message: null });
    expect(run.progress.value).toBeUndefined();
    id.value = undefined;
    await nextTick();
    expect(FakeEventSource.instances[1].close).toHaveBeenCalled();
    expect(run.status.value).toBeUndefined();
  });

  it("closes the stream for a finished run and loads its saved log", async () => {
    const r: RouteTable = routes();
    r["GET /api/runs/r2/log"] = () =>
      new Response("hello\n[stderr] warn\n[task] note\n");
    stubFetch(r);
    const { run } = mount(ref("r2"));
    const es = FakeEventSource.last();
    // The server closes an empty stream for old runs before `seed` resolves.
    es.onerror?.(new Event("error"));
    expect(run.error.value).toBeUndefined();
    await flush();
    expect(run.status.value).toBe("done");
    expect(es.close).toHaveBeenCalled();
    await flush();
    // The server no longer buffers this run, so the log comes from log.txt.
    expect(run.log.value).toEqual([
      { stream: "stdout", line: "hello" },
      { stream: "stderr", line: "warn" },
      { stream: "task", line: "note" },
    ]);
  });

  it("retries an outputs revision after a failed fetch", async () => {
    const r: RouteTable = routes();
    let fail = true;
    r["GET /api/runs/r1/outputs"] = () =>
      fail ? { body: { error: "boom" }, status: 500 } : FIXTURE_OUTPUTS;
    stubFetch(r);
    const { run } = mount();
    await flush();
    const es = FakeEventSource.last();
    es.emit("outputs", { revision: 1, partial: false, names: ["series"] });
    await flush();
    await flush();
    expect(run.outputs.value).toBeUndefined();
    fail = false;
    es.emit("outputs", { revision: 1, partial: false, names: ["series"] });
    await flush();
    await flush();
    expect(run.outputs.value?.series.length).toBe(3);
  });

  it("keeps outputs moving while revisions arrive faster than fetches", async () => {
    const r: RouteTable = routes();
    const pending: (() => void)[] = [];
    r["GET /api/runs/r1/outputs"] = () =>
      new Promise((resolve) => pending.push(() => resolve(FIXTURE_OUTPUTS)));
    const { calls } = stubFetch(r);
    const { run } = mount();
    await flush();
    const es = FakeEventSource.last();
    const outputFetches = () =>
      calls.filter((c) => c.url === "/api/runs/r1/outputs").length;
    es.emit("outputs", { revision: 1, partial: true, names: ["series"] });
    await flush();
    es.emit("outputs", { revision: 2, partial: true, names: ["series"] });
    es.emit("outputs", { revision: 3, partial: true, names: ["series"] });
    await flush();
    // The in-flight fetch is not aborted by newer revisions.
    expect(outputFetches()).toBe(1);
    pending.shift()!();
    await flush();
    await flush();
    expect(run.revision.value).toBe(1);
    expect(outputFetches()).toBe(2);
    pending.shift()!();
    await flush();
    await flush();
    expect(run.revision.value).toBe(3);
    expect(outputFetches()).toBe(2);
  });

  it("retries a failed final outputs fetch when the run finishes", async () => {
    const r: RouteTable = routes();
    let fail = true;
    r["GET /api/runs/r1/outputs"] = () =>
      fail ? { body: { error: "boom" }, status: 500 } : FIXTURE_OUTPUTS;
    stubFetch(r);
    const { run } = mount();
    await flush();
    const es = FakeEventSource.last();
    es.emit("outputs", { revision: 1, partial: false, names: ["series"] });
    await flush();
    await flush();
    expect(run.error.value).toBe("boom");
    fail = false;
    es.emit("done", {});
    await flush();
    await flush();
    expect(run.revision.value).toBe(1);
    expect(run.outputs.value?.series.length).toBe(3);
    expect(run.error.value).toBeUndefined();
  });

  it("replays a finished run's history before closing its stream", async () => {
    stubFetch(routes());
    const { run } = mount(ref("r2"));
    await flush();
    const es = FakeEventSource.last();
    expect(run.status.value).toBe("done");
    expect(es.close).not.toHaveBeenCalled();
    es.emit("log", { stream: "stdout", line: "hello", overwrite: false });
    es.emit("done", {});
    expect(run.log.value.map((l) => l.line)).toEqual(["hello"]);
    expect(es.close).toHaveBeenCalled();
  });

  it("has no file URLs without a run", () => {
    stubFetch(routes());
    const { run } = mount(ref<string | undefined>(undefined));
    expect(run.fileUrl("a.csv")).toBe("");
  });

  it("ignores the browser's own error event on the error listener", async () => {
    stubFetch(routes());
    const { run } = mount();
    await flush();
    const es = FakeEventSource.last();
    // A closed stream fires a plain Event named "error" with no data.
    expect(() => es.dispatchEvent(new Event("error"))).not.toThrow();
    expect(run.status.value).toBe("running");
    expect(run.error.value).toBeUndefined();
  });

  it("surfaces a lost connection while active and clears it on reconnect", async () => {
    stubFetch(routes());
    const { run } = mount();
    await flush();
    const es = FakeEventSource.last();
    es.onerror?.(new Event("error"));
    expect(run.error.value).toMatch(/lost/);
    expect(es.close).not.toHaveBeenCalled();
    es.onopen?.(new Event("open"));
    expect(run.error.value).toBeUndefined();
    es.emit("done", {});
    es.onerror?.(new Event("error"));
    expect(es.close).toHaveBeenCalled();
  });

  it("reports a failed seed", async () => {
    stubFetch({
      "GET /api/runs/r1": { body: { error: "unknown run" }, status: 404 },
    });
    const { run } = mount();
    await flush();
    expect(run.error.value).toBe("unknown run");
  });
});

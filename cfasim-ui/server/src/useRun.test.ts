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

const routes = (): RouteTable => ({
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
afterEach(() => vi.unstubAllGlobals());

function mount(id = ref<string | undefined>("r1")) {
  const scope = effectScope();
  const run = scope.run(() => useRun(id))!;
  return { scope, run, id };
}

describe("useRun", () => {
  it("seeds summary, streams progress/log overwrites, and closes on done", async () => {
    stubFetch(routes());
    const { run, scope } = mount();
    const source = FakeEventSource.last();
    expect(source.url).toBe("/api/runs/r1/events");
    await flush();
    expect(run.status.value).toBe("running");
    expect(run.fileUrl("sub/a b.csv")).toBe("/api/runs/r1/files/sub/a%20b.csv");

    source.emit("progress", { fraction: 0.5, message: "half" });
    source.emit("log", { stream: "stdout", line: "hello", overwrite: false });
    source.emit("log", { stream: "stderr", line: "10%", overwrite: true });
    source.emit("log", { stream: "stderr", line: "20%", overwrite: true });
    expect(run.progress.value).toEqual({ fraction: 0.5, message: "half" });
    expect(run.log.value.map((entry) => entry.line)).toEqual(["hello", "20%"]);

    source.emit("done", {});
    await flush();
    expect(run.status.value).toBe("done");
    expect(source.close).toHaveBeenCalled();
    scope.stop();
  });

  it("handles connection loss/reconnect and closes on error events", async () => {
    stubFetch(routes());
    const { run } = mount();
    await flush();
    const source = FakeEventSource.last();

    expect(() => source.dispatchEvent(new Event("error"))).not.toThrow();
    source.onerror?.(new Event("error"));
    expect(run.error.value).toMatch(/lost/);
    expect(source.close).not.toHaveBeenCalled();
    source.onopen?.(new Event("open"));
    expect(run.error.value).toBeUndefined();

    source.emit("error", { message: "RuntimeError: kaboom", traceback: "..." });
    expect(run.status.value).toBe("error");
    expect(run.error.value).toBe("RuntimeError: kaboom");
    expect(source.close).toHaveBeenCalled();
  });

  it("coalesces burst revisions, retries on done, ignores stale ones, and switches runs", async () => {
    const table = routes();
    let fail = true;
    table["GET /api/runs/r1/outputs"] = () =>
      fail ? { body: { error: "boom" }, status: 500 } : FIXTURE_OUTPUTS;
    table["GET /api/runs/r2/log"] = () =>
      new Response("hello\n[stderr] warn\n");
    const { calls } = stubFetch(table);
    const { run, id } = mount();
    await flush();
    const first = FakeEventSource.last();

    first.emit("outputs", { revision: 1, partial: true, names: ["series"] });
    first.emit("outputs", { revision: 2, partial: false, names: ["series"] });
    await flush();
    await flush();
    expect(run.error.value).toBe("boom");

    fail = false;
    first.emit("done", {});
    await flush();
    await flush();
    expect(run.revision.value).toBe(2);
    expect(run.outputs.value?.series.length).toBe(3);

    const countBefore = calls.filter(
      (call) => call.url === "/api/runs/r1/outputs",
    ).length;
    first.emit("outputs", { revision: 1, partial: true, names: ["series"] });
    await flush();
    expect(
      calls.filter((call) => call.url === "/api/runs/r1/outputs"),
    ).toHaveLength(countBefore);

    id.value = "r2";
    await nextTick();
    expect(first.close).toHaveBeenCalled();
    const second = FakeEventSource.last();
    second.onerror?.(new Event("error"));
    await flush();
    await flush();
    expect(second.close).toHaveBeenCalled();
    expect(run.log.value).toEqual([
      { stream: "stdout", line: "hello" },
      { stream: "stderr", line: "warn" },
    ]);
  });
});

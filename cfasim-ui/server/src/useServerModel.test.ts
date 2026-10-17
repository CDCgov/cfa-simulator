import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { effectScope, reactive } from "vue";
import { useServerModel } from "./useServerModel.js";
import { FakeEventSource, flush, stubFetch, summary } from "./testUtils.js";

const tasks = [{ name: "echo", doc: null, params: [], accepts_extra: false }];

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mount(baseUrl?: string) {
  const scope = effectScope();
  const model = scope.run(() => useServerModel({ baseUrl }))!;
  return { scope, model };
}

describe("useServerModel", () => {
  it("lists tasks and runs on creation", async () => {
    stubFetch({
      "GET /api/tasks": { tasks },
      "GET /api/runs": { runs: [summary()] },
    });
    const { model } = mount();
    await flush();
    expect(model.tasks.value.map((t) => t.name)).toEqual(["echo"]);
    expect(model.runs.value.map((r) => r.run_id)).toEqual(["r1"]);
    expect(model.connected.value).toBe(true);
    expect(model.current.id.value).toBeUndefined();
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("starts a run with plain inputs and follows it", async () => {
    const { calls } = stubFetch({
      "GET /api/tasks": { tasks },
      "GET /api/runs": { runs: [] },
      "POST /api/tasks/echo/run": {
        run_id: "r9",
        inputs_hash: "h",
        status: "queued",
      },
      "GET /api/runs/r9": summary({ run_id: "r9", status: "queued" }),
      "GET /api/runs/r9/inputs": { n: 2 },
      "GET /api/runs/r9/files": { files: [] },
    });
    const { model } = mount();
    const params = reactive({ n: 2, nested: { a: [1, 2] } });
    const id = await model.start("echo", params, { name: " baseline " });
    expect(id).toBe("r9");
    const post = calls.find((c) => c.method === "POST")!;
    expect(JSON.parse(post.body!)).toEqual({
      inputs: { n: 2, nested: { a: [1, 2] } },
      name: "baseline",
    });
    await flush();
    expect(model.current.id.value).toBe("r9");
    expect(FakeEventSource.last().url).toBe("/api/runs/r9/events");
    const runsBefore = calls.filter((c) => c.url === "/api/runs").length;
    FakeEventSource.last().emit("done", {});
    await flush();
    expect(calls.filter((c) => c.url === "/api/runs").length).toBe(
      runsBefore + 1,
    );
  });

  it("loads an existing run and cancels the current one", async () => {
    const { calls } = stubFetch({
      "GET /api/tasks": { tasks },
      "GET /api/runs": { runs: [] },
      "GET /api/runs/r1": summary(),
      "GET /api/runs/r1/inputs": {},
      "GET /api/runs/r1/files": { files: [] },
      "POST /api/runs/r1/cancel": { run_id: "r1", status: "cancelling" },
    });
    const { model } = mount();
    model.load("r1");
    await flush();
    expect(model.current.status.value).toBe("running");
    await model.cancel();
    expect(calls.some((c) => c.url === "/api/runs/r1/cancel")).toBe(true);
    await model.cancel(undefined);
    model.load(undefined);
    await model.cancel();
    expect(calls.filter((c) => c.url === "/api/runs/r1/cancel")).toHaveLength(
      2,
    );
  });

  it("reports an unreachable server and server-side errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const { model, scope } = mount("/backend/");
    await flush();
    expect(model.connected.value).toBe(false);
    expect(model.error.value).toMatch(/\/backend/);
    scope.stop();

    stubFetch({
      "GET /api/tasks": { tasks },
      "GET /api/runs": { runs: [] },
      "POST /api/tasks/echo/run": {
        body: { error: "missing required input(s): n" },
        status: 400,
      },
    });
    const { model: m2 } = mount();
    await flush();
    await expect(m2.start("echo", {})).resolves.toBeUndefined();
    expect(m2.error.value).toBe("missing required input(s): n");
    expect(m2.connected.value).toBe(true);
  });

  it("treats a dev-proxy 502 as unreachable and reconnects", async () => {
    vi.useFakeTimers();
    try {
      let up = false;
      const down = () =>
        new Response("", { status: 502, statusText: "Bad Gateway" });
      const { calls } = stubFetch({
        "GET /api/tasks": () => (up ? { tasks } : down()),
        "GET /api/runs": () => (up ? { runs: [summary()] } : down()),
      });
      const { model, scope } = mount();
      await vi.advanceTimersByTimeAsync(0);
      expect(model.connected.value).toBe(false);
      expect(model.error.value).toMatch(/Could not reach/);
      up = true;
      await vi.advanceTimersByTimeAsync(3000);
      expect(model.connected.value).toBe(true);
      expect(model.error.value).toBeUndefined();
      expect(model.tasks.value.map((t) => t.name)).toEqual(["echo"]);
      expect(model.runs.value.map((r) => r.run_id)).toEqual(["r1"]);
      const before = calls.length;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(calls.length).toBe(before);
      scope.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops retrying once disposed", async () => {
    vi.useFakeTimers();
    try {
      const { calls } = stubFetch({
        "GET /api/tasks": () => new Response("", { status: 502 }),
        "GET /api/runs": () => new Response("", { status: 502 }),
      });
      const { scope } = mount();
      await vi.advanceTimersByTimeAsync(0);
      scope.stop();
      const before = calls.length;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(calls.length).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies only the newest runs list when responses arrive out of order", async () => {
    const pending: ((runs: unknown) => void)[] = [];
    stubFetch({
      "GET /api/tasks": { tasks },
      "GET /api/runs": () =>
        new Promise((resolve) =>
          pending.push((runs) =>
            resolve(new Response(JSON.stringify({ runs }))),
          ),
        ),
    });
    const { model, scope } = mount();
    await flush();
    const second = model.refreshRuns();
    await flush();
    expect(pending).toHaveLength(2);
    pending[1]([summary({ run_id: "new" })]);
    await second;
    pending[0]([summary({ run_id: "old" })]);
    await flush();
    expect(model.runs.value.map((r) => r.run_id)).toEqual(["new"]);
    scope.stop();
  });

  it("hands out independent run handles for comparison", async () => {
    stubFetch({
      "GET /api/tasks": { tasks },
      "GET /api/runs": { runs: [] },
      "GET /api/runs/r1": summary(),
      "GET /api/runs/r1/inputs": {},
      "GET /api/runs/r1/files": { files: [] },
      "GET /api/runs/r2": summary({ run_id: "r2", status: "done" }),
      "GET /api/runs/r2/inputs": {},
      "GET /api/runs/r2/files": { files: [] },
    });
    const { model, scope } = mount();
    const a = scope.run(() => model.useRun("r1"))!;
    const b = scope.run(() => model.useRun("r2"))!;
    await flush();
    expect(a.status.value).toBe("running");
    expect(b.status.value).toBe("done");
    expect(FakeEventSource.instances.map((e) => e.url)).toEqual([
      "/api/runs/r1/events",
      "/api/runs/r2/events",
    ]);
    scope.stop();
    expect(
      FakeEventSource.instances.every((e) => e.close.mock.calls.length),
    ).toBe(true);
  });
});

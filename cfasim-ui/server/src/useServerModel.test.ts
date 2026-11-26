import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { effectScope, reactive } from "vue";
import { useServerModel } from "./useServerModel.js";
import { FakeEventSource, flush, stubFetch, summary } from "./testUtils.js";

const tasks = [{ name: "echo", doc: null, params: [], accepts_extra: false }];

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => vi.unstubAllGlobals());

function mount(baseUrl?: string) {
  const scope = effectScope();
  const model = scope.run(() => useServerModel({ baseUrl }))!;
  return { scope, model };
}

describe("useServerModel", () => {
  it("lists tasks/runs, starts a run, follows it, and refreshes on done", async () => {
    const { calls } = stubFetch({
      "GET /api/tasks": { tasks },
      "GET /api/runs": { runs: [summary()] },
      "POST /api/tasks/echo/run": {
        run_id: "r9",
        inputs_hash: "h",
        status: "queued",
      },
      "GET /api/runs/r9": summary({ run_id: "r9", status: "queued" }),
      "GET /api/runs/r9/inputs": { n: 2 },
      "GET /api/runs/r9/files": { files: [] },
    });
    const { model, scope } = mount();
    await flush();
    expect(model.connected.value).toBe(true);
    expect(model.tasks.value.map((task) => task.name)).toEqual(["echo"]);

    const id = await model.start("echo", reactive({ n: 2 }), {
      name: " baseline ",
    });
    expect(id).toBe("r9");
    const post = calls.find((call) => call.method === "POST")!;
    expect(JSON.parse(post.body!)).toEqual({
      inputs: { n: 2 },
      name: "baseline",
    });
    await flush();
    expect(model.current.id.value).toBe("r9");
    const runsBefore = calls.filter((call) => call.url === "/api/runs").length;
    FakeEventSource.last().emit("done", {});
    await flush();
    expect(calls.filter((call) => call.url === "/api/runs").length).toBe(
      runsBefore + 1,
    );
    scope.stop();
  });

  it("loads/cancels runs and closes independent useRun handles on dispose", async () => {
    const { calls } = stubFetch({
      "GET /api/tasks": { tasks },
      "GET /api/runs": { runs: [] },
      "GET /api/runs/r1": summary(),
      "GET /api/runs/r1/inputs": {},
      "GET /api/runs/r1/files": { files: [] },
      "POST /api/runs/r1/cancel": { run_id: "r1", status: "cancelling" },
    });
    const { model, scope } = mount();
    model.load("r1");
    await flush();
    await model.cancel();
    expect(calls.some((call) => call.url === "/api/runs/r1/cancel")).toBe(true);

    const handle = scope.run(() => model.useRun("r1"))!;
    await flush();
    expect(handle.status.value).toBe("running");
    scope.stop();
    expect(
      FakeEventSource.instances.every((es) => es.close.mock.calls.length > 0),
    ).toBe(true);
  });

  it("reports 400 errors and retries 502 until reconnected or disposed", async () => {
    stubFetch({
      "GET /api/tasks": { tasks },
      "GET /api/runs": { runs: [] },
      "POST /api/tasks/echo/run": { body: { error: "missing n" }, status: 400 },
    });
    const { model, scope } = mount();
    await flush();
    await expect(model.start("echo", {})).resolves.toBeUndefined();
    expect(model.error.value).toBe("missing n");
    scope.stop();

    vi.useFakeTimers();
    try {
      let up = false;
      const down = () => new Response("", { status: 502 });
      const { calls } = stubFetch({
        "GET /api/tasks": () => (up ? { tasks } : down()),
        "GET /api/runs": () => (up ? { runs: [summary()] } : down()),
      });
      const retry = mount();
      await vi.advanceTimersByTimeAsync(0);
      expect(retry.model.connected.value).toBe(false);
      up = true;
      await vi.advanceTimersByTimeAsync(3000);
      expect(retry.model.connected.value).toBe(true);
      retry.scope.stop();
      const before = calls.length;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(calls.length).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
});

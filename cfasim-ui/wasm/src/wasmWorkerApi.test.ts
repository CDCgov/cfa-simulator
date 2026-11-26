import { describe, it, expect, vi, beforeAll } from "vitest";
import { reactive } from "vue";
import type { WorkerMessage } from "./messages.js";

class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];
  posted: WorkerMessage[] = [];
  terminated = false;
  constructor() {
    super();
    FakeWorker.instances.push(this);
  }
  postMessage(message: WorkerMessage) {
    this.posted.push(structuredClone(message));
  }
  terminate() {
    this.terminated = true;
  }
  reply(data: Record<string, unknown>) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
  fail(message: string) {
    const event = new Event("error") as Event & { message: string };
    event.message = message;
    this.dispatchEvent(event);
  }
  static current() {
    return FakeWorker.instances[FakeWorker.instances.length - 1];
  }
}

let runWasm: typeof import("./wasmWorkerApi.js").runWasm;
let callWasm: typeof import("./wasmWorkerApi.js").callWasm;
let cancelWasm: typeof import("./wasmWorkerApi.js").cancelWasm;

beforeAll(async () => {
  vi.stubGlobal("Worker", FakeWorker);
  ({ runWasm, callWasm, cancelWasm } = await import("./wasmWorkerApi.js"));
});

const lastPosted = (worker: FakeWorker) =>
  worker.posted[worker.posted.length - 1];
const PANIC = "Model panicked at src/lib.rs:21:9: rate must be <= 5, got 9";

describe("wasmWorkerApi", () => {
  it("resolves by id and keeps the worker on ordinary errors", async () => {
    const worker = FakeWorker.current();
    const ok = runWasm("m", "double", "2");
    const { id } = lastPosted(worker);
    worker.reply({ id: id + 1000, result: "ignored" });
    worker.reply({ id, result: 4 });
    await expect(ok).resolves.toBe(4);

    const err = runWasm("m", "fallible", "9");
    worker.reply({ id: lastPosted(worker).id, error: "bad input" });
    await expect(err).rejects.toThrow("bad input");
    expect(worker.terminated).toBe(false);
  });

  it("replaces worker on trap, fails repeats, and re-sends distinct calls", async () => {
    const old = FakeWorker.current();
    const trapped = callWasm("m", "boom", { rate: 9, sizes: [1, 2] });
    const repeat = callWasm("m", "boom", { sizes: [1, 2], rate: 9 });
    const survivor = callWasm("m", "boom", { rate: 1, sizes: [1, 2] });
    const trappedId = old.posted[old.posted.length - 3].id;
    const survivorId = lastPosted(old).id;

    old.reply({ id: trappedId, error: PANIC, trap: "call" });
    await expect(trapped).rejects.toThrow(PANIC);
    await expect(repeat).rejects.toThrow(PANIC);

    const fresh = FakeWorker.current();
    expect(old.terminated).toBe(true);
    expect(fresh.posted.map((msg) => msg.id)).toEqual([survivorId]);
    old.reply({ id: survivorId, result: "stale" });
    fresh.reply({ id: survivorId, result: 6 });
    await expect(survivor).resolves.toBe(6);
  });

  it("handles init traps, worker error retry window, reactive inputs, and cancelWasm", async () => {
    vi.useFakeTimers();
    try {
      const old = FakeWorker.current();
      const init = runWasm("broken", "a");
      const sameModel = runWasm("broken", "b", "x");
      const otherModel = runWasm("fine", "a");
      const initId = old.posted[old.posted.length - 3].id;
      const otherId = lastPosted(old).id;

      old.reply({ id: initId, error: "init trap", trap: "init" });
      await expect(init).rejects.toThrow("init trap");
      await expect(sameModel).rejects.toThrow("init trap");
      const fresh = FakeWorker.current();
      fresh.reply({ id: otherId, result: "ok" });
      await expect(otherModel).resolves.toBe("ok");

      const slow = runWasm("m", "slow");
      fresh.fail("Worker failed to load");
      await expect(slow).rejects.toThrow("Worker failed to load");
      vi.advanceTimersByTime(2000);
      const retry = runWasm("m", "ok", "1");
      const respawned = FakeWorker.current();
      respawned.reply({ id: lastPosted(respawned).id, result: 2 });
      await expect(retry).resolves.toBe(2);

      const params = reactive({
        rate: 2.5,
        contacts: [new Float64Array([1, 0.5])],
      });
      const call = callWasm("m", "simulate", { ...params });
      respawned.reply({ id: lastPosted(respawned).id, result: "ok" });
      await expect(call).resolves.toBe("ok");
      await expect(
        callWasm("m", "simulate", { fn: () => 1 }),
      ).rejects.toThrow();

      const pending = runWasm("m", "slow");
      cancelWasm();
      await expect(pending).rejects.toThrow("cancelled");
      expect(respawned.terminated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

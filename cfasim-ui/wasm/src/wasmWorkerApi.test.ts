import { describe, it, expect, vi, beforeAll } from "vitest";
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
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  reply(data: Record<string, unknown>) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  fail(message: string) {
    const e = new Event("error") as Event & { message: string };
    e.message = message;
    this.dispatchEvent(e);
  }

  static current(): FakeWorker {
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

function lastPosted(w: FakeWorker): WorkerMessage {
  return w.posted[w.posted.length - 1];
}

const PANIC = "Model panicked at src/lib.rs:21:9: rate must be <= 5, got 9";

describe("runWasm", () => {
  it("resolves a plain result by request id", async () => {
    const w = FakeWorker.current();
    const p = runWasm("m", "double", "2");
    const { id } = lastPosted(w);
    w.reply({ id: id + 1000, result: "not mine" });
    w.reply({ id, result: 4 });
    await expect(p).resolves.toBe(4);
  });

  it("rejects an ordinary error, even an empty one, and keeps the worker", async () => {
    const w = FakeWorker.current();
    const p = runWasm("m", "fallible", "9");
    w.reply({ id: lastPosted(w).id, error: "rate must be <= 5, got 9" });
    await expect(p).rejects.toThrow("rate must be <= 5, got 9");
    const empty = runWasm("m", "fallible", "");
    w.reply({ id: lastPosted(w).id, error: "" });
    await expect(empty).rejects.toThrow();
    expect(w.terminated).toBe(false);
    expect(FakeWorker.current()).toBe(w);
  });

  it("replaces the worker after a trap and re-sends the other calls", async () => {
    const old = FakeWorker.current();
    const trapped = runWasm("m", "boom", "9");
    const survivor = runWasm("m", "ok", "3");
    const trappedId = old.posted[old.posted.length - 2].id;
    const survivorId = lastPosted(old).id;

    old.reply({ id: trappedId, error: PANIC, trap: "call" });
    await expect(trapped).rejects.toThrow(PANIC);

    const fresh = FakeWorker.current();
    expect(old.terminated).toBe(true);
    expect(fresh).not.toBe(old);
    expect(fresh.posted).toEqual([
      { id: survivorId, model: "m", fn: "ok", args: ["3"] },
    ]);

    // Late events from the retired worker are ignored; the fresh one answers.
    old.reply({ id: survivorId, result: "stale" });
    old.fail("stale worker error");
    fresh.reply({ id: survivorId, result: 6 });
    await expect(survivor).resolves.toBe(6);

    // The replacement is live for new calls.
    const next = runWasm("m", "ok", "4");
    fresh.reply({ id: lastPosted(fresh).id, result: 8 });
    await expect(next).resolves.toBe(8);
  });

  it("fails queued repeats of the trapped call instead of re-sending them", async () => {
    const old = FakeWorker.current();
    const first = runWasm("m", "boom", "9");
    const repeat = runWasm("m", "boom", "9");
    const other = runWasm("m", "boom", "1");
    const firstId = old.posted[old.posted.length - 3].id;
    const otherId = lastPosted(old).id;

    old.reply({ id: firstId, error: PANIC, trap: "call" });
    await expect(first).rejects.toThrow(PANIC);
    await expect(repeat).rejects.toThrow(PANIC);

    const fresh = FakeWorker.current();
    expect(fresh.posted.map((m) => m.id)).toEqual([otherId]);
    fresh.reply({ id: otherId, result: 1 });
    await expect(other).resolves.toBe(1);
  });

  it("fails every queued call into a model whose init trapped", async () => {
    const old = FakeWorker.current();
    const init = runWasm("broken", "a");
    const sameModel = runWasm("broken", "b", "x");
    const otherModel = runWasm("fine", "a");
    const initId = old.posted[old.posted.length - 3].id;
    const otherId = lastPosted(old).id;

    const message = "Model panicked or aborted while initializing";
    vi.useFakeTimers();
    try {
      old.reply({ id: initId, error: message, trap: "init" });
      await expect(init).rejects.toThrow(message);
      await expect(sameModel).rejects.toThrow(message);

      const fresh = FakeWorker.current();
      expect(old.terminated).toBe(true);
      expect(fresh.posted.map((m) => m.id)).toEqual([otherId]);
      fresh.reply({ id: otherId, result: "ok" });
      await expect(otherModel).resolves.toBe("ok");

      // Within the retry window a new call into that model is rejected
      // without reaching the worker; afterwards it is sent again.
      await expect(runWasm("broken", "a")).rejects.toThrow(message);
      expect(fresh.posted).toHaveLength(1);
      vi.advanceTimersByTime(2000);
      const later = runWasm("broken", "a");
      expect(fresh.posted).toHaveLength(2);
      fresh.reply({ id: lastPosted(fresh).id, result: "fixed" });
      await expect(later).resolves.toBe("fixed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails pending calls on a worker error and starts fresh after a short wait", async () => {
    vi.useFakeTimers();
    try {
      const w = FakeWorker.current();
      const p = runWasm("m", "slow");
      w.fail("Worker failed to load");
      await expect(p).rejects.toThrow("Worker failed to load");

      // Within the retry window the same rejection comes back, no spawn.
      await expect(runWasm("m", "ok", "0")).rejects.toThrow(
        "Worker failed to load",
      );
      expect(FakeWorker.current()).toBe(w);

      vi.advanceTimersByTime(2000);
      const retry = runWasm("m", "ok", "1");
      const fresh = FakeWorker.current();
      expect(fresh).not.toBe(w);
      expect(w.terminated).toBe(true);
      fresh.reply({ id: lastPosted(fresh).id, result: 2 });
      await expect(retry).resolves.toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancelWasm rejects in-flight calls with 'cancelled'", async () => {
    const w = FakeWorker.current();
    const p = runWasm("m", "slow");
    cancelWasm();
    await expect(p).rejects.toThrow("cancelled");
    expect(w.terminated).toBe(true);
    expect(FakeWorker.current()).not.toBe(w);
  });

  it("callWasm sends named inputs, and the same values positionally", async () => {
    const w = FakeWorker.current();
    const p = callWasm("m", "simulate", {
      rate: 2.5,
      stochastic: false,
      contacts: [new Float64Array([1, 0.5]), [0.5, 1]],
      group: { label: "adults" },
    });
    const { id, inputs, args } = lastPosted(w);
    expect(JSON.parse(inputs!)).toEqual({
      rate: 2.5,
      stochastic: false,
      contacts: [
        [1, 0.5],
        [0.5, 1],
      ],
      group: { label: "adults" },
    });
    expect(args.slice(0, 2)).toEqual(["2.5", "false"]);
    w.reply({ id, result: "ok" });
    await expect(p).resolves.toBe("ok");
  });

  it("re-sends a named call with other inputs after a trap", async () => {
    const old = FakeWorker.current();
    const trapped = callWasm("m", "simulate", { rate: 9 });
    const repeat = callWasm("m", "simulate", { rate: 9 });
    const other = callWasm("m", "simulate", { rate: 1 });
    const trappedId = old.posted[old.posted.length - 3].id;
    const otherId = lastPosted(old).id;

    old.reply({ id: trappedId, error: PANIC, trap: "call" });
    await expect(trapped).rejects.toThrow(PANIC);
    await expect(repeat).rejects.toThrow(PANIC);

    const fresh = FakeWorker.current();
    expect(fresh.posted).toEqual([
      {
        id: otherId,
        model: "m",
        fn: "simulate",
        args: ["1"],
        inputs: '{"rate":1}',
      },
    ]);
    fresh.reply({ id: otherId, result: 1 });
    await expect(other).resolves.toBe(1);
  });
});

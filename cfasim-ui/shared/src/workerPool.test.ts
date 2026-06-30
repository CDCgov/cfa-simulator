import { describe, expect, it } from "vitest";
import { createWorkerPool, describeWorkerError } from "./workerPool.js";

// Minimal Worker stand-in: records outgoing postMessage calls and lets the test
// drive "message"/"error"/"messageerror" events back into the pool.
class FakeWorker {
  listeners: Record<string, Set<(e: any) => void>> = {};
  posted: any[] = [];
  private repliedIds = new Set<number>();

  addEventListener(type: string, fn: (e: any) => void) {
    (this.listeners[type] ??= new Set()).add(fn);
  }
  removeEventListener(type: string, fn: (e: any) => void) {
    this.listeners[type]?.delete(fn);
  }
  postMessage(msg: any) {
    this.posted.push(msg);
  }
  emit(type: string, event: any) {
    for (const fn of [...(this.listeners[type] ?? [])]) fn(event);
  }
  // Reply to one posted message by index.
  replyTo(index: number, partial: Record<string, unknown>) {
    const { id } = this.posted[index];
    this.repliedIds.add(id);
    this.emit("message", { data: { id, ...partial } });
  }
  // Reply to every outstanding request (defaults to a success result).
  replyPending(partial: Record<string, unknown> = { result: true }) {
    for (const msg of this.posted) {
      if (this.repliedIds.has(msg.id)) continue;
      this.repliedIds.add(msg.id);
      this.emit("message", { data: { id: msg.id, ...partial } });
    }
  }
  loads() {
    return this.posted.filter((m) => m.type === "load");
  }
}

function makePool() {
  const created: FakeWorker[] = [];
  const pool = createWorkerPool({
    createWorker: () => {
      const w = new FakeWorker();
      created.push(w);
      return w as unknown as Worker;
    },
    loadMessage: (key) => ({ type: "load", key }),
  });
  return { pool, created };
}

describe("createWorkerPool", () => {
  it("posts the request with an id and resolves on the matching reply", async () => {
    const { pool, created } = makePool();
    const p = pool.request("default", { type: "run", x: 1 });
    const w = created[0];
    expect(w.posted[0]).toMatchObject({ type: "run", x: 1 });
    expect(typeof w.posted[0].id).toBe("number");

    // A reply for a different id is ignored; the matching one resolves it.
    w.emit("message", { data: { id: w.posted[0].id + 999, result: "nope" } });
    w.replyTo(0, { result: "ok" });
    expect(await p).toEqual({ result: "ok" });
  });

  it("caches loads per key so a model installs only once per worker", async () => {
    const { pool, created } = makePool();
    const p1 = pool.ensureLoaded("m");
    const p2 = pool.ensureLoaded("m");
    const w = created[0];
    expect(w.loads()).toHaveLength(1);
    expect(w.posted[0]).toMatchObject({ type: "load", key: "m" });

    w.replyTo(0, { result: true });
    expect(await p1).toEqual({ result: true });
    expect(await p2).toEqual({ result: true });
  });

  it("re-loads after a failed install (cache is cleared on error)", async () => {
    const { pool, created } = makePool();
    const p1 = pool.ensureLoaded("m");
    const w = created[0];
    w.replyTo(0, { error: "install failed" });
    expect(await p1).toEqual({ error: "install failed" });

    const p2 = pool.ensureLoaded("m");
    expect(w.loads()).toHaveLength(2);
    w.replyTo(1, { result: true });
    expect(await p2).toEqual({ result: true });
  });

  it("shares a loaded model across existing and future workers", async () => {
    const { pool, created } = makePool();
    const reqA = pool.request("a", { type: "ping" });
    const a = created[0];
    a.replyPending();
    await reqA;

    const loadPromise = pool.load("m");
    const def = created[1];
    a.replyPending();
    def.replyPending();
    expect(await loadPromise).toEqual({ result: true });
    expect(a.loads().some((m) => m.key === "m")).toBe(true);
    expect(def.loads().some((m) => m.key === "m")).toBe(true);

    // A worker spawned later auto-installs the shared model before its own work.
    const reqB = pool.request("b", { type: "ping" });
    const b = created[2];
    expect(b.posted[0]).toMatchObject({ type: "load", key: "m" });
    b.replyPending();
    await reqB;
  });

  it("loadOnWorker does not mark the model shared", async () => {
    const { pool, created } = makePool();
    const onA = pool.loadOnWorker("m", "a");
    created[0].replyPending();
    await onA;

    const reqB = pool.request("b", { type: "ping" });
    const b = created[1];
    // b is not auto-loaded with "m" because loadOnWorker didn't share it.
    expect(b.loads()).toHaveLength(0);
    b.replyPending();
    await reqB;
  });

  it("warm pre-spawns workers and pre-loads the given keys on each", async () => {
    const { pool, created } = makePool();
    const warm = pool.warm({ workers: ["a", "b"], keys: ["m"] });
    expect(created).toHaveLength(2);
    for (const w of created) {
      expect(w.loads().some((m) => m.key === "m")).toBe(true);
      w.replyPending();
    }
    await warm;
  });

  it("drains pending requests and short-circuits after a worker error", async () => {
    const { pool, created } = makePool();
    const p = pool.request("default", { type: "run" });
    const w = created[0];
    w.emit("error", { message: "boom", filename: "f.js", lineno: 3 });
    expect(await p).toEqual({ error: "boom (f.js:3)" });

    // Further requests to the dead worker short-circuit with the same error.
    expect(await pool.request("default", { type: "run" })).toEqual({
      error: "boom (f.js:3)",
    });
  });

  it("reports a messageerror with the configured text", async () => {
    const created: FakeWorker[] = [];
    const pool = createWorkerPool({
      createWorker: () => {
        const w = new FakeWorker();
        created.push(w);
        return w as unknown as Worker;
      },
      loadMessage: (key) => ({ type: "load", key }),
      messageErrorText: "custom messageerror",
    });
    const p = pool.request("default", { type: "run" });
    created[0].emit("messageerror", {});
    expect(await p).toEqual({ error: "custom messageerror" });
  });
});

describe("describeWorkerError", () => {
  it("includes file/line when present", () => {
    expect(
      describeWorkerError({
        message: "oops",
        filename: "w.js",
        lineno: 12,
      } as ErrorEvent),
    ).toBe("oops (w.js:12)");
  });

  it("falls back to the message without a filename", () => {
    expect(describeWorkerError({ message: "oops" } as ErrorEvent)).toBe("oops");
  });

  it("uses the fallback when the event is sanitized to empty", () => {
    expect(describeWorkerError({ message: "" } as ErrorEvent)).toMatch(
      /no error details available/,
    );
    expect(
      describeWorkerError({ message: "" } as ErrorEvent, "custom fallback"),
    ).toBe("custom fallback");
  });
});

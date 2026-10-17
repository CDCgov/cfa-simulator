// Test doubles for the composable tests: a controllable EventSource and a
// fetch stub answering the server's REST routes. Not collected by vitest.

import { vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { RunSummary } from "./types.js";

export class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = [];
  readyState = 0;
  onerror: ((e: Event) => void) | null = null;
  onopen: ((e: Event) => void) | null = null;
  close = vi.fn(() => {
    this.readyState = 2;
  });

  constructor(readonly url: string) {
    super();
    FakeEventSource.instances.push(this);
  }

  emit(type: string, data: unknown) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
  }

  static last(): FakeEventSource {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1];
  }

  static reset() {
    FakeEventSource.instances = [];
  }
}

export const FIXTURE_OUTPUTS = readFileSync(
  fileURLToPath(
    new URL(
      "../../../cfasim-model-py/tests/fixtures/sample.cfasim",
      import.meta.url,
    ),
  ),
);

export function summary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    run_id: "r1",
    name: null,
    task: "echo",
    inputs_hash: "abc",
    status: "running",
    created_at: "2026-10-16T00:00:00",
    started_at: null,
    finished_at: null,
    progress: null,
    outputs: null,
    error: null,
    ...overrides,
  };
}

/** A response body, a `{ body, status }` pair, raw bytes, or a (possibly async) function of the request. */
export type RouteTable = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Install a fetch stub answering `METHOD path` keys; records calls. */
export function stubFetch(routes: RouteTable) {
  const calls: { method: string; url: string; body?: string }[] = [];
  const fetchMock = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      calls.push({ method, url, body: init?.body as string | undefined });
      const key = `${method} ${url.split("?")[0]}`;
      if (!(key in routes)) return json({ error: `no route ${key}` }, 404);
      let value = routes[key];
      if (typeof value === "function") value = await value(init);
      if (value instanceof Response) return value;
      if (value instanceof Uint8Array) {
        const bytes = new Uint8Array(value.byteLength);
        bytes.set(value);
        return new Response(bytes.buffer, {
          headers: { "content-type": "application/octet-stream" },
        });
      }
      if (
        value &&
        typeof value === "object" &&
        "body" in (value as Record<string, unknown>) &&
        "status" in (value as Record<string, unknown>)
      ) {
        const v = value as { body: unknown; status?: number };
        return json(v.body, v.status);
      }
      return json(value);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

export function flush() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

import { describe, it, expect, vi } from "vitest";
import {
  describeWasmTrap,
  describeWasmInitTrap,
  describeWorkerError,
  isWasmTrap,
} from "./workerError.js";
import { postErrorWithTransfer } from "./transferUtils.js";

describe("describeWasmTrap", () => {
  it("reports a recorded panic with its location", () => {
    expect(
      describeWasmTrap(
        "unreachable",
        "panicked at src/lib.rs:21:9: rate must be <= 5, got 9",
        true,
      ),
    ).toBe("Model panicked at src/lib.rs:21:9: rate must be <= 5, got 9");
  });

  it("explains an unreachable trap with no panic as OOM or a replaced hook", () => {
    expect(describeWasmTrap("unreachable", undefined, true)).toMatch(
      /aborted without a recorded panic message.*out of memory.*replaced the panic hook/,
    );
  });

  it("recognizes every engine's wording of the unreachable trap", () => {
    for (const text of [
      "unreachable executed",
      "Unreachable code should not be executed (evaluating 'wasm.simulate(a)')",
    ]) {
      expect(describeWasmTrap(text, undefined, true)).toMatch(/aborted/);
      expect(describeWasmTrap(text, undefined, false)).toMatch(/rebuild/);
    }
  });

  it("asks for a rebuild against current cfasim-model when the hook is missing", () => {
    expect(describeWasmTrap("unreachable", undefined, false)).toMatch(
      /rebuild it against the current cfasim-model/,
    );
  });

  it("passes other trap messages through", () => {
    expect(
      describeWasmTrap("memory access out of bounds", undefined, true),
    ).toBe("Model trapped: memory access out of bounds");
  });
});

describe("describeWasmInitTrap", () => {
  it("explains an abort in init and passes other traps through", () => {
    expect(describeWasmInitTrap("unreachable executed")).toMatch(
      /panicked or aborted while initializing/,
    );
    expect(describeWasmInitTrap("Maximum call stack size exceeded")).toBe(
      "Model trapped while initializing: Maximum call stack size exceeded",
    );
  });
});

describe("isWasmTrap", () => {
  it("recognizes traps and engine stack overflows, not ordinary errors", () => {
    expect(isWasmTrap(new WebAssembly.RuntimeError("unreachable"))).toBe(true);
    expect(isWasmTrap(new RangeError("Maximum call stack size exceeded"))).toBe(
      true,
    );
    const spiderMonkey = new Error("too much recursion");
    spiderMonkey.name = "InternalError";
    expect(isWasmTrap(spiderMonkey)).toBe(true);
    expect(isWasmTrap(new RangeError("Invalid array length"))).toBe(false);
    expect(isWasmTrap(new Error("rate must be <= 5"))).toBe(false);
    expect(isWasmTrap("unreachable")).toBe(false);
  });
});

describe("postErrorWithTransfer", () => {
  it("flags a trap only when asked", () => {
    const port = { postMessage: vi.fn() } as unknown as typeof globalThis;
    postErrorWithTransfer(port, 1, new Error("boom"));
    postErrorWithTransfer(port, 2, "plain", { trap: "call" });
    expect(port.postMessage).toHaveBeenNthCalledWith(1, {
      id: 1,
      error: "boom",
    });
    expect(port.postMessage).toHaveBeenNthCalledWith(2, {
      id: 2,
      error: "plain",
      trap: "call",
    });
  });
});

describe("describeWorkerError", () => {
  it("falls back to a hint when the event is sanitized", () => {
    const e = { message: "", filename: "", lineno: 0 } as ErrorEvent;
    expect(describeWorkerError(e)).toMatch(/no error details/);
  });
});

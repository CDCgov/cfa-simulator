import { describe, it, expect, vi } from "vitest";
import {
  describeWasmTrap,
  describeWasmInitTrap,
  describeWorkerError,
  isWasmTrap,
} from "./workerError.js";
import { postErrorWithTransfer } from "./transferUtils.js";

describe("workerError", () => {
  it("describes wasm call/init traps and identifies trap error types", () => {
    expect(
      describeWasmTrap("unreachable", "panicked at src/lib.rs:21:9: bad", true),
    ).toBe("Model panicked at src/lib.rs:21:9: bad");
    expect(describeWasmTrap("unreachable executed", undefined, true)).toMatch(
      /aborted without a recorded panic message/,
    );
    expect(describeWasmTrap("unreachable", undefined, false)).toMatch(
      /rebuild it against the current cfasim-model/,
    );
    expect(
      describeWasmTrap("memory access out of bounds", undefined, true),
    ).toBe("Model trapped: memory access out of bounds");
    expect(describeWasmInitTrap("unreachable executed")).toMatch(
      /panicked or aborted while initializing/,
    );

    expect(isWasmTrap(new WebAssembly.RuntimeError("unreachable"))).toBe(true);
    expect(isWasmTrap(new RangeError("Maximum call stack size exceeded"))).toBe(
      true,
    );
    const spiderMonkey = new Error("too much recursion");
    spiderMonkey.name = "InternalError";
    expect(isWasmTrap(spiderMonkey)).toBe(true);
    expect(isWasmTrap(new RangeError("Invalid array length"))).toBe(false);
    expect(isWasmTrap(new Error("rate must be <= 5"))).toBe(false);
  });

  it("posts error messages with optional trap flag and handles sanitized events", () => {
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
    expect(
      describeWorkerError({
        message: "",
        filename: "",
        lineno: 0,
      } as ErrorEvent),
    ).toMatch(/no error details/);
  });
});

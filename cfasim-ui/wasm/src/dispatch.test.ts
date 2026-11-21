import { describe, it, expect, vi, afterEach } from "vitest";
import { callModelFunction } from "./dispatch.js";

function fakeModule(named: string[] = []) {
  return {
    simulate: vi.fn((...received: unknown[]) => received),
    __cfasim_named_inputs: vi.fn(() => named.join(",")),
  };
}

const INPUTS = '{"rate":2.5,"steps":10}';

afterEach(() => {
  vi.restoreAllMocks();
});

describe("callModelFunction", () => {
  it("passes named inputs as one object to an export! function", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = fakeModule(["simulate", "other"]);
    const message = {
      model: "named",
      fn: "simulate",
      args: ["2.5", "10"],
      inputs: INPUTS,
    };
    expect(callModelFunction(mod, message)).toEqual([INPUTS]);
    callModelFunction(mod, message);
    expect(mod.__cfasim_named_inputs).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to positional arguments and warns once per function", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = fakeModule();
    const message = {
      model: "legacy",
      fn: "simulate",
      args: ["2.5", "10"],
      inputs: INPUTS,
    };
    expect(callModelFunction(mod, message)).toEqual(["2.5", "10"]);
    callModelFunction(mod, message);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("legacy.simulate");
  });

  it("calls positionally without a warning when no inputs are sent", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // A model built before export! existed has no marker export at all.
    const mod = { double: (value: string) => Number(value) * 2 };
    const message = { model: "raw", fn: "double", args: ["4"] };
    expect(callModelFunction(mod, message)).toBe(8);
    expect(warn).not.toHaveBeenCalled();
  });

  it("names a function the model does not export", () => {
    const message = { model: "m", fn: "missing", args: [], inputs: "{}" };
    expect(() => callModelFunction(fakeModule(), message)).toThrow(
      "Model m has no function missing",
    );
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { callModelFunction } from "./dispatch.js";

function fakeModule(named: string[] = []) {
  return {
    simulate: vi.fn((...received: unknown[]) => received),
    __cfasim_named_inputs: vi.fn(() => named.join(",")),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("callModelFunction", () => {
  it("passes named inputs as one object to an export! function", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = fakeModule(["simulate", "other"]);
    const contacts = new Float64Array([1, 0.5]);
    const call = () =>
      callModelFunction(mod, {
        model: "named",
        fn: "simulate",
        inputs: { rate: 2.5, horizon: Infinity, contacts },
      });
    expect(call()).toEqual([{ rate: 2.5, horizon: Infinity, contacts }]);
    call();
    expect(mod.__cfasim_named_inputs).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("treats undefined named inputs as missing, at any depth", () => {
    const mod = fakeModule(["simulate"]);
    const inputs = {
      steps: 10,
      rate: undefined,
      groups: [{ label: "adults", size: undefined }],
    };
    const result = callModelFunction(mod, {
      model: "named",
      fn: "simulate",
      inputs,
    });
    expect(result).toEqual([{ steps: 10, groups: [{ label: "adults" }] }]);
    expect(Object.keys(inputs)).toEqual(["steps", "groups"]);
    expect(Object.keys(inputs.groups[0])).toEqual(["label"]);
  });

  it("spreads inputs positionally for a plain function and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = fakeModule();
    const call = () =>
      callModelFunction(mod, {
        model: "legacy",
        fn: "simulate",
        inputs: { rate: 2.5, steps: undefined, stochastic: false },
      });
    // Values keep their position, as strings, even when undefined.
    expect(call()).toEqual(["2.5", "undefined", "false"]);
    call();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("legacy.simulate");
  });

  it("does not warn about key order when there is a single input", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = callModelFunction(fakeModule(), {
      model: "single",
      fn: "simulate",
      inputs: { json: '{"rate":2.5}' },
    });
    expect(result).toEqual(['{"rate":2.5}']);
    expect(warn).not.toHaveBeenCalled();
  });

  it("calls positionally without a warning when given args", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // A model built before export! existed has no marker export at all.
    const mod = { add: (a: string, b: string) => Number(a) + Number(b) };
    const message = { model: "raw", fn: "add", args: ["4", "5"] };
    expect(callModelFunction(mod, message)).toBe(9);
    expect(warn).not.toHaveBeenCalled();
  });

  it("names a function the model does not export", () => {
    const message = { model: "m", fn: "missing", inputs: {} };
    expect(() => callModelFunction(fakeModule(), message)).toThrow(
      "Model m has no function missing",
    );
  });
});

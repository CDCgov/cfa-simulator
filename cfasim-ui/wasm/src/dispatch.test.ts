import { describe, it, expect, vi, afterEach } from "vitest";
import { callModelFunction } from "./dispatch.js";

function fakeModule(named: string[] = []) {
  return {
    simulate: vi.fn((...received: unknown[]) => received),
    __cfasim_named_inputs: vi.fn(() => named.join(",")),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("callModelFunction", () => {
  it("passes named inputs as one object and strips undefined at any depth", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = fakeModule(["simulate"]);
    const contacts = new Float64Array([1, 0.5]);
    const inputs = {
      steps: 10,
      rate: undefined,
      contacts,
      groups: [{ label: "adults", size: undefined }],
    };
    expect(
      callModelFunction(mod, { model: "named", fn: "simulate", inputs }),
    ).toEqual([{ steps: 10, contacts, groups: [{ label: "adults" }] }]);
    expect(Object.keys(inputs)).toEqual(["steps", "contacts", "groups"]);
    expect(Object.keys(inputs.groups[0])).toEqual(["label"]);

    callModelFunction(mod, { model: "named", fn: "simulate", inputs: {} });
    expect(mod.__cfasim_named_inputs).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to positional stringified args with warn-once and handles explicit args", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = fakeModule();
    const call = () =>
      callModelFunction(mod, {
        model: "legacy",
        fn: "simulate",
        inputs: { rate: 2.5, steps: undefined, stochastic: false },
      });
    expect(call()).toEqual(["2.5", "undefined", "false"]);
    call();
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockClear();
    const raw = { add: (a: string, b: string) => Number(a) + Number(b) };
    expect(
      callModelFunction(raw, { model: "raw", fn: "add", args: ["4", "5"] }),
    ).toBe(9);
    expect(warn).not.toHaveBeenCalled();
    expect(() =>
      callModelFunction(fakeModule(), {
        model: "m",
        fn: "missing",
        inputs: {},
      }),
    ).toThrow("Model m has no function missing");
  });
});

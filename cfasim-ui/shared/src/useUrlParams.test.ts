import { describe, it, expect } from "vitest";
import {
  serialize,
  deserialize,
  paramsToQuery,
  queryToParams,
} from "./useUrlParams.js";

describe("serialize", () => {
  it("stringifies numbers and booleans", () => {
    expect(serialize(42)).toBe("42");
    expect(serialize(true)).toBe("true");
    expect(serialize(false)).toBe("false");
  });

  it("joins arrays with commas", () => {
    expect(serialize([1, 2, 3])).toBe("1,2,3");
    expect(serialize(["a", "b"])).toBe("a,b");
  });
});

describe("deserialize", () => {
  it("coerces based on default type", () => {
    expect(deserialize("true", false)).toBe(true);
    expect(deserialize("false", true)).toBe(false);
    expect(deserialize("3.14", 0)).toBe(3.14);
    expect(deserialize("hello", "x")).toBe("hello");
  });

  it("falls back to default on NaN", () => {
    expect(deserialize("not-a-number", 7)).toBe(7);
  });

  it("parses comma-separated arrays of numbers", () => {
    expect(deserialize("1,2,3", [0])).toEqual([1, 2, 3]);
  });

  it("keeps non-numeric array entries as strings", () => {
    expect(deserialize("a,b,c", [""])).toEqual(["a", "b", "c"]);
  });
});

describe("paramsToQuery", () => {
  it("omits values that match defaults", () => {
    const defaults = { a: 1, b: 2, c: 3 };
    expect(paramsToQuery({ a: 1, b: 2, c: 3 }, defaults)).toEqual({});
  });

  it("includes only changed values", () => {
    const defaults = { a: 1, b: 2, c: 3 };
    expect(paramsToQuery({ a: 1, b: 5, c: 3 }, defaults)).toEqual({ b: "5" });
  });

  it("serializes arrays", () => {
    const defaults = { k: [1, 2] };
    expect(paramsToQuery({ k: [3, 4] }, defaults)).toEqual({ k: "3,4" });
  });

  it("handles booleans", () => {
    const defaults = { on: false };
    expect(paramsToQuery({ on: true }, defaults)).toEqual({ on: "true" });
    expect(paramsToQuery({ on: false }, defaults)).toEqual({});
  });
});

describe("queryToParams", () => {
  it("returns empty when query has no overlap", () => {
    const defaults = { a: 1 };
    expect(queryToParams({ unrelated: "x" }, defaults)).toEqual({});
  });

  it("ignores unknown keys", () => {
    const defaults = { a: 1 };
    expect(queryToParams({ a: "2", b: "3" }, defaults)).toEqual({ a: 2 });
  });

  it("ignores non-string query values", () => {
    const defaults = { a: 1 };
    expect(queryToParams({ a: ["2", "3"] }, defaults)).toEqual({});
  });

  it("coerces types from defaults", () => {
    const defaults = { n: 0, b: false, s: "", arr: [0] };
    expect(
      queryToParams({ n: "5", b: "true", s: "hi", arr: "1,2" }, defaults),
    ).toEqual({ n: 5, b: true, s: "hi", arr: [1, 2] });
  });
});

import { describe, it, expect, vi } from "vitest";
import { defineComponent, h, ref, reactive, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import {
  serialize,
  deserialize,
  paramsToQuery,
  queryToParams,
  useUrlParams,
  jsonCodec,
  type UrlParamsRouter,
  type UrlParamsRoute,
} from "./useUrlParams.js";

type InfectionRate =
  | { type: "constant"; value: number; duration: number }
  | { type: "empirical"; points: [number, number][] };

function makeRouterStub(initialQuery: Record<string, unknown> = {}) {
  const route = reactive<UrlParamsRoute>({ query: { ...initialQuery } });
  const replace = vi.fn(({ query }: { query: Record<string, string> }) => {
    route.query = { ...query };
  });
  const router: UrlParamsRouter = { replace };
  return { router, route, replace };
}

function mountWith<R>(factory: () => R) {
  let api!: R;
  mount(defineComponent({ setup: () => ((api = factory()), () => h("div")) }));
  return api;
}

describe("serialize / deserialize / query conversion", () => {
  it("round-trips primitives, arrays, defaults omission, and invalid fallbacks", () => {
    expect(serialize(42)).toBe("42");
    expect(serialize([1, 2])).toBe("1,2");
    expect(deserialize("true", false)).toBe(true);
    expect(deserialize("not-a-number", 7)).toBe(7);
    expect(deserialize("1,2", [0])).toEqual([1, 2]);
    expect(deserialize("a,b", [""])).toEqual(["a", "b"]);

    const defaults = { n: 0, b: false, s: "x", arr: [1, 2] };
    expect(paramsToQuery(defaults, defaults)).toEqual({});
    expect(
      paramsToQuery({ n: 5, b: true, s: "x", arr: [3, 4] }, defaults),
    ).toEqual({
      n: "5",
      b: "true",
      arr: "3,4",
    });
    expect(
      queryToParams({ n: "5", b: "true", arr: "3,4", unknown: "1" }, defaults),
    ).toEqual({ n: 5, b: true, arr: [3, 4] });
    expect(queryToParams({ n: ["2", "3"] }, defaults)).toEqual({});
  });

  it("handles nested objects, URI-encoded dot keys, arrays of objects, and matrices", () => {
    const defaults = {
      nested: { foo: 5, "a.b": 2 },
      items: [
        { name: "a", value: 1 },
        { name: "b", value: 2 },
      ],
      matrix: [
        [1, 2],
        [3, 4],
      ],
    };
    const query = paramsToQuery(
      {
        nested: { foo: 7, "a.b": 9 },
        items: [
          { name: "a", value: 1 },
          { name: "b", value: 99 },
        ],
        matrix: [
          [1, 2],
          [8, 9],
        ],
      },
      defaults,
    );
    expect(query).toEqual({
      "nested.foo": "7",
      "nested.a%2Eb": "9",
      "items.1.value": "99",
      "matrix.1": "8,9",
    });
    expect(
      queryToParams({ ...query, "nested.unknown": "1" }, defaults),
    ).toEqual({
      nested: { foo: 7, "a.b": 9 },
      items: [undefined, { value: 99 }],
      matrix: [undefined, [8, 9]],
    });
  });

  it("encodes/decodes codecs atomically and swallows malformed payloads", () => {
    const defaults: { rate: InfectionRate; n: number } = {
      rate: { type: "constant", value: 0.5, duration: 3 },
      n: 0,
    };
    const empirical: InfectionRate = { type: "empirical", points: [[0, 1]] };
    const hexCodec = {
      serialize: (value: unknown) => Number(value).toString(16),
      deserialize: (raw: string) => Number.parseInt(raw, 16),
    };
    const codecs = { rate: jsonCodec, n: hexCodec };

    expect(paramsToQuery(defaults, defaults, codecs)).toEqual({});
    const query = paramsToQuery({ rate: empirical, n: 255 }, defaults, codecs);
    expect(query).toEqual({ rate: JSON.stringify(empirical), n: "ff" });
    expect(queryToParams(query, defaults, codecs)).toEqual({
      rate: empirical,
      n: 255,
    });
    expect(
      queryToParams({ "rate.value": "0.9", rate: "{bad" }, defaults, codecs),
    ).toEqual({});
  });
});

describe("useUrlParams", () => {
  it("hydrates reactive/ref params and writes updates back via router.replace", async () => {
    const stub1 = makeRouterStub({ a: "5" });
    const params = reactive({ a: 1, b: 2 });
    mountWith(() =>
      useUrlParams(params, { a: 1, b: 2 }, { ...stub1, debounceMs: 0 }),
    );
    await nextTick();
    expect(params).toEqual({ a: 5, b: 2 });

    params.a = 7;
    await nextTick();
    await new Promise((res) => setTimeout(res, 5));
    expect(stub1.replace).toHaveBeenCalled();
    expect(stub1.route.query).toEqual({ a: "7" });

    const stub2 = makeRouterStub({ a: "9" });
    const refParams = ref({ a: 1, b: 2 });
    mountWith(() =>
      useUrlParams(refParams, { a: 1, b: 2 }, { ...stub2, debounceMs: 0 }),
    );
    await nextTick();
    expect(refParams.value).toEqual({ a: 9, b: 2 });
  });

  it("supports include/ignore filtering and nested/leaf-array hydration", async () => {
    const stub1 = makeRouterStub({ a: "5", b: "99" });
    const p1 = reactive({ a: 1, b: 2 });
    mountWith(() =>
      useUrlParams(
        p1,
        { a: 1, b: 2 },
        { ...stub1, debounceMs: 0, include: ["a"], ignore: ["a"] },
      ),
    );
    await nextTick();
    expect(p1).toEqual({ a: 5, b: 2 });

    const stub2 = makeRouterStub();
    const p2 = reactive({ nested: { foo: 1, bar: 2 } });
    mountWith(() =>
      useUrlParams(
        p2,
        { nested: { foo: 1, bar: 2 } },
        { ...stub2, debounceMs: 0, ignore: ["nested.bar"] },
      ),
    );
    await nextTick();
    p2.nested.foo = 7;
    p2.nested.bar = 11;
    await nextTick();
    await new Promise((res) => setTimeout(res, 5));
    expect(stub2.route.query).toEqual({ "nested.foo": "7" });

    const defaults = {
      items: [
        { name: "a", value: 1 },
        { name: "b", value: 2 },
      ],
      matrix: [
        [1, 2],
        [3, 4],
      ],
    };
    const stub3 = makeRouterStub({ "items.1.value": "99", "matrix.0": "7" });
    const p3 = reactive(structuredClone(defaults));
    mountWith(() => useUrlParams(p3, defaults, { ...stub3, debounceMs: 0 }));
    await nextTick();
    expect(p3.items).toEqual([
      { name: "a", value: 1 },
      { name: "b", value: 99 },
    ]);
    expect(p3.matrix).toEqual([[7], [3, 4]]);
  });

  it("supports reset, lazy getter defaults, and codec round-trip", async () => {
    const variant: InfectionRate = { type: "empirical", points: [[0, 1]] };
    const defaults: { a: number; rate: InfectionRate } = {
      a: 1,
      rate: { type: "constant", value: 0.5, duration: 3 },
    };
    const stub = makeRouterStub({ a: "5", rate: JSON.stringify(variant) });
    const params = reactive(structuredClone(defaults));
    const api = mountWith(() =>
      useUrlParams(params, defaults, {
        ...stub,
        debounceMs: 0,
        codecs: { rate: jsonCodec },
      }),
    );
    await nextTick();
    expect(params).toEqual({ a: 5, rate: variant });

    stub.replace.mockClear();
    api.reset({ clearUrl: false });
    await nextTick();
    expect(params).toEqual(defaults);
    expect(stub.replace).not.toHaveBeenCalled();

    params.a = 8;
    api.reset();
    await nextTick();
    expect(stub.route.query).toEqual({});

    let ready: { a: number } | undefined;
    const lazyParams = reactive({ a: 0 });
    const lazyApi = mountWith(() =>
      useUrlParams(lazyParams, () => ready, {
        ...makeRouterStub({ a: "7" }),
        debounceMs: 0,
      }),
    );
    await nextTick();
    expect(lazyApi.hydrate()).toBe(false);
    ready = { a: 0 };
    expect(lazyApi.hydrate()).toBe(true);
    expect(lazyParams.a).toBe(7);
  });
});

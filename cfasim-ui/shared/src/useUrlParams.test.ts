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

type InfectionRate =
  | { type: "constant"; value: number; duration: number }
  | { type: "empirical"; points: [number, number][] };

describe("paramsToQuery (with codecs)", () => {
  it("treats a codec path as a single atomic URL key", () => {
    const defaults: { rate: InfectionRate } = {
      rate: { type: "constant", value: 0.5, duration: 3 },
    };
    const params: { rate: InfectionRate } = {
      rate: {
        type: "empirical",
        points: [
          [0, 0],
          [2, 1],
        ],
      },
    };
    expect(paramsToQuery(params, defaults, { rate: jsonCodec })).toEqual({
      rate: JSON.stringify(params.rate),
    });
  });

  it("omits a codec value that stringifies equal to the default", () => {
    const defaults = { rate: { type: "constant", value: 0.5 } };
    const params = { rate: { type: "constant", value: 0.5 } };
    expect(paramsToQuery(params, defaults, { rate: jsonCodec })).toEqual({});
  });

  it("emits codec keys alongside ordinary leaves", () => {
    const defaults = {
      population: 10_000,
      rate: { type: "constant", value: 0.5 } as { type: string; value: number },
    };
    const params = {
      population: 20_000,
      rate: { type: "constant", value: 0.5 } as { type: string; value: number },
    };
    expect(paramsToQuery(params, defaults, { rate: jsonCodec })).toEqual({
      population: "20000",
      // rate matches → omitted
    });
  });
});

describe("queryToParams (with codecs)", () => {
  it("decodes a codec value through its custom deserializer", () => {
    const defaults: { rate: InfectionRate } = {
      rate: { type: "constant", value: 0.5, duration: 3 },
    };
    const variant: InfectionRate = {
      type: "empirical",
      points: [
        [0, 0],
        [2, 1],
      ],
    };
    expect(
      queryToParams({ rate: JSON.stringify(variant) }, defaults, {
        rate: jsonCodec,
      }),
    ).toEqual({ rate: variant });
  });

  it("drops URL keys nested inside a codec boundary", () => {
    const defaults: { rate: InfectionRate } = {
      rate: { type: "constant", value: 0.5, duration: 3 },
    };
    // Stale leaf keys from the constant variant should not punch through
    // the codec value.
    expect(
      queryToParams({ "rate.value": "0.9", "rate.duration": "7" }, defaults, {
        rate: jsonCodec,
      }),
    ).toEqual({});
  });

  it("swallows malformed codec payloads instead of throwing", () => {
    const defaults = { rate: { type: "constant", value: 0.5 } };
    expect(
      queryToParams({ rate: "{not-valid-json" }, defaults, { rate: jsonCodec }),
    ).toEqual({});
  });

  it("supports a custom codec (base-N encoded number)", () => {
    const hexCodec = {
      serialize: (v: unknown) => Number(v).toString(16),
      deserialize: (raw: string) => Number.parseInt(raw, 16),
    };
    const defaults = { n: 0 };
    expect(queryToParams({ n: "ff" }, defaults, { n: hexCodec })).toEqual({
      n: 255,
    });
    expect(paramsToQuery({ n: 255 }, defaults, { n: hexCodec })).toEqual({
      n: "ff",
    });
  });
});

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
  const wrapper = mount(
    defineComponent({
      setup() {
        api = factory();
        return () => h("div");
      },
    }),
  );
  return { wrapper, api: api as R };
}

describe("useUrlParams (composable)", () => {
  it("hydrates a reactive params object from initial query", async () => {
    const { router, route } = makeRouterStub({ a: "5" });
    const params = reactive({ a: 1, b: 2 });
    mountWith(() =>
      useUrlParams(
        params,
        { a: 1, b: 2 },
        {
          router,
          route,
          debounceMs: 0,
        },
      ),
    );
    await nextTick();
    expect(params.a).toBe(5);
    expect(params.b).toBe(2);
  });

  it("hydrates a ref params object from initial query", async () => {
    const { router, route } = makeRouterStub({ a: "9" });
    const params = ref({ a: 1, b: 2 });
    mountWith(() =>
      useUrlParams(
        params,
        { a: 1, b: 2 },
        {
          router,
          route,
          debounceMs: 0,
        },
      ),
    );
    await nextTick();
    expect(params.value).toEqual({ a: 9, b: 2 });
  });

  it("writes changed params back to the URL", async () => {
    const { router, route, replace } = makeRouterStub();
    const params = reactive({ a: 1, b: 2 });
    mountWith(() =>
      useUrlParams(
        params,
        { a: 1, b: 2 },
        {
          router,
          route,
          debounceMs: 0,
        },
      ),
    );
    await nextTick();
    params.a = 7;
    await nextTick();
    await new Promise((r) => setTimeout(r, 5));
    expect(replace).toHaveBeenCalled();
    expect(route.query).toEqual({ a: "7" });
  });

  describe("include / ignore", () => {
    it("include limits the keys that sync to the URL", async () => {
      const { router, route } = makeRouterStub();
      const params = reactive({ a: 1, b: 2, c: 3 });
      mountWith(() =>
        useUrlParams(
          params,
          { a: 1, b: 2, c: 3 },
          { router, route, debounceMs: 0, include: ["a"] },
        ),
      );
      await nextTick();
      params.a = 5;
      params.b = 99;
      await nextTick();
      await new Promise((r) => setTimeout(r, 5));
      expect(route.query).toEqual({ a: "5" });
    });

    it("ignore skips listed keys but syncs the rest", async () => {
      const { router, route } = makeRouterStub();
      const params = reactive({ a: 1, b: 2, c: 3 });
      mountWith(() =>
        useUrlParams(
          params,
          { a: 1, b: 2, c: 3 },
          { router, route, debounceMs: 0, ignore: ["c"] },
        ),
      );
      await nextTick();
      params.a = 5;
      params.c = 99;
      await nextTick();
      await new Promise((r) => setTimeout(r, 5));
      expect(route.query).toEqual({ a: "5" });
    });

    it("include takes precedence over ignore", async () => {
      const { router, route } = makeRouterStub();
      const params = reactive({ a: 1, b: 2, c: 3 });
      mountWith(() =>
        useUrlParams(
          params,
          { a: 1, b: 2, c: 3 },
          {
            router,
            route,
            debounceMs: 0,
            include: ["a"],
            ignore: ["a"],
          },
        ),
      );
      await nextTick();
      params.a = 5;
      params.b = 99;
      await nextTick();
      await new Promise((r) => setTimeout(r, 5));
      expect(route.query).toEqual({ a: "5" });
    });

    it("does not hydrate keys outside the include set", async () => {
      const { router, route } = makeRouterStub({ a: "5", b: "99" });
      const params = reactive({ a: 1, b: 2 });
      mountWith(() =>
        useUrlParams(
          params,
          { a: 1, b: 2 },
          { router, route, debounceMs: 0, include: ["a"] },
        ),
      );
      await nextTick();
      expect(params.a).toBe(5);
      expect(params.b).toBe(2);
    });

    it("preserves ignored keys on a reactive params object across hydrate", async () => {
      const { router, route } = makeRouterStub({ a: "5" });
      const params = reactive({ a: 1, ephemeral: "keep-me" });
      mountWith(() =>
        useUrlParams(
          params,
          { a: 1, ephemeral: "default" },
          { router, route, debounceMs: 0, ignore: ["ephemeral"] },
        ),
      );
      await nextTick();
      expect(params.a).toBe(5);
      expect(params.ephemeral).toBe("keep-me");
    });
  });

  describe("reset", () => {
    it("resets params to defaults and clears URL by default", async () => {
      const { router, route, replace } = makeRouterStub({ a: "5" });
      const params = reactive({ a: 1, b: 2 });
      const { api } = mountWith(() =>
        useUrlParams(
          params,
          { a: 1, b: 2 },
          {
            router,
            route,
            debounceMs: 0,
          },
        ),
      );
      await nextTick();
      expect(params.a).toBe(5);
      api.reset();
      await nextTick();
      expect(params).toEqual({ a: 1, b: 2 });
      expect(replace).toHaveBeenLastCalledWith({ query: {} });
    });

    it("does not touch the URL when clearUrl: false", async () => {
      const { router, route, replace } = makeRouterStub({ a: "5" });
      const params = reactive({ a: 1, b: 2 });
      const { api } = mountWith(() =>
        useUrlParams(
          params,
          { a: 1, b: 2 },
          {
            router,
            route,
            debounceMs: 0,
          },
        ),
      );
      await nextTick();
      replace.mockClear();
      api.reset({ clearUrl: false });
      await nextTick();
      expect(params).toEqual({ a: 1, b: 2 });
      expect(replace).not.toHaveBeenCalled();
    });
  });

  describe("nested params", () => {
    it("hydrates a nested leaf from a dotted query key", async () => {
      const { router, route } = makeRouterStub({ "nested.foo": "9" });
      const params = reactive({ a: 1, nested: { foo: 5, bar: 10 } });
      mountWith(() =>
        useUrlParams(
          params,
          { a: 1, nested: { foo: 5, bar: 10 } },
          { router, route, debounceMs: 0 },
        ),
      );
      await nextTick();
      expect(params.a).toBe(1);
      expect(params.nested).toEqual({ foo: 9, bar: 10 });
    });

    it("writes only changed nested leaves with dotted keys", async () => {
      const { router, route } = makeRouterStub();
      const params = reactive({ a: 1, nested: { foo: 5, bar: 10 } });
      mountWith(() =>
        useUrlParams(
          params,
          { a: 1, nested: { foo: 5, bar: 10 } },
          { router, route, debounceMs: 0 },
        ),
      );
      await nextTick();
      params.nested.foo = 7;
      await nextTick();
      await new Promise((r) => setTimeout(r, 5));
      expect(route.query).toEqual({ "nested.foo": "7" });
    });

    it("round-trips a deeply nested structure", async () => {
      const { router, route } = makeRouterStub({
        "deep.a.b.c": "42",
        "deep.flag": "true",
      });
      const defaults = { deep: { a: { b: { c: 0 } }, flag: false } };
      const params = reactive(structuredClone(defaults));
      mountWith(() =>
        useUrlParams(params, defaults, { router, route, debounceMs: 0 }),
      );
      await nextTick();
      expect(params.deep.a.b.c).toBe(42);
      expect(params.deep.flag).toBe(true);
    });

    it("preserves sibling leaves when an override updates one branch", async () => {
      const { router, route } = makeRouterStub({ "nested.foo": "99" });
      const params = reactive({ nested: { foo: 1, bar: 2, baz: 3 } });
      mountWith(() =>
        useUrlParams(
          params,
          { nested: { foo: 1, bar: 2, baz: 3 } },
          { router, route, debounceMs: 0 },
        ),
      );
      await nextTick();
      expect(params.nested).toEqual({ foo: 99, bar: 2, baz: 3 });
    });

    it("drops dotted keys that have no matching default leaf", async () => {
      const defaults = { nested: { foo: 1 } };
      expect(
        queryToParams({ "nested.unknown": "5", "nested.foo": "9" }, defaults),
      ).toEqual({ nested: { foo: 9 } });
    });

    it("paramsToQuery emits only nested leaves that differ", () => {
      const defaults = { a: 1, nested: { foo: 5, bar: 10 } };
      expect(
        paramsToQuery({ a: 1, nested: { foo: 7, bar: 10 } }, defaults),
      ).toEqual({ "nested.foo": "7" });
    });

    it("include with a parent path covers all descendants", async () => {
      const { router, route } = makeRouterStub();
      const params = reactive({ a: 1, nested: { foo: 5, bar: 10 } });
      mountWith(() =>
        useUrlParams(
          params,
          { a: 1, nested: { foo: 5, bar: 10 } },
          { router, route, debounceMs: 0, include: ["nested"] },
        ),
      );
      await nextTick();
      params.a = 99;
      params.nested.foo = 7;
      params.nested.bar = 11;
      await nextTick();
      await new Promise((r) => setTimeout(r, 5));
      expect(route.query).toEqual({ "nested.foo": "7", "nested.bar": "11" });
    });

    it("ignore with a dotted path skips a single leaf", async () => {
      const { router, route } = makeRouterStub();
      const params = reactive({ nested: { foo: 5, bar: 10 } });
      mountWith(() =>
        useUrlParams(
          params,
          { nested: { foo: 5, bar: 10 } },
          { router, route, debounceMs: 0, ignore: ["nested.bar"] },
        ),
      );
      await nextTick();
      params.nested.foo = 7;
      params.nested.bar = 11;
      await nextTick();
      await new Promise((r) => setTimeout(r, 5));
      expect(route.query).toEqual({ "nested.foo": "7" });
    });

    it("URI-encodes segments so keys containing dots round-trip", () => {
      const defaults = { "weird.key": 1, nested: { "a.b": 2 } };
      const params = { "weird.key": 5, nested: { "a.b": 7 } };
      const query = paramsToQuery(params, defaults);
      expect(query).toEqual({
        "weird%2Ekey": "5",
        "nested.a%2Eb": "7",
      });
      expect(queryToParams(query, defaults)).toEqual({
        "weird.key": 5,
        nested: { "a.b": 7 },
      });
    });

    it("flattens an array of objects into indexed dotted paths", () => {
      const defaults = {
        items: [
          { name: "a", value: 1 },
          { name: "b", value: 2 },
        ],
      };
      const params = {
        items: [
          { name: "a", value: 1 },
          { name: "b", value: 99 },
        ],
      };
      expect(paramsToQuery(params, defaults)).toEqual({
        "items.1.value": "99",
      });
    });

    it("rebuilds array-shaped defaults from indexed dotted keys", () => {
      const defaults = {
        items: [
          { name: "a", value: 1 },
          { name: "b", value: 2 },
        ],
      };
      expect(queryToParams({ "items.0.value": "5" }, defaults)).toEqual({
        items: [{ value: 5 }],
      });
    });

    it("array of arrays recurses with numeric indices, inner arrays stay leaves", () => {
      const defaults = {
        matrix: [
          [1, 2],
          [3, 4],
        ],
      };
      const params = {
        matrix: [
          [1, 2],
          [9, 9],
        ],
      };
      expect(paramsToQuery(params, defaults)).toEqual({
        "matrix.1": "9,9",
      });
      expect(queryToParams({ "matrix.0": "7,8" }, defaults)).toEqual({
        matrix: [[7, 8]],
      });
    });

    it("URL override on a leaf array replaces it wholesale (does not merge element-wise)", async () => {
      const { router, route } = makeRouterStub({ "matrix.0": "7" });
      const defaults = {
        matrix: [
          [1, 2],
          [3, 4],
        ],
      };
      const params = reactive(structuredClone(defaults));
      mountWith(() =>
        useUrlParams(params, defaults, { router, route, debounceMs: 0 }),
      );
      await nextTick();
      expect(params.matrix).toEqual([[7], [3, 4]]);
    });

    it("array-of-primitives still round-trips as a comma-joined leaf", () => {
      const defaults = { tags: [1, 2, 3] };
      expect(paramsToQuery({ tags: [4, 5, 6] }, defaults)).toEqual({
        tags: "4,5,6",
      });
      expect(queryToParams({ tags: "4,5,6" }, defaults)).toEqual({
        tags: [4, 5, 6],
      });
    });

    it("updates one element of an array-of-objects via the URL while preserving siblings", async () => {
      const { router, route } = makeRouterStub({ "items.1.value": "99" });
      const defaults = {
        items: [
          { name: "a", value: 1 },
          { name: "b", value: 2 },
        ],
      };
      const params = reactive(structuredClone(defaults));
      mountWith(() =>
        useUrlParams(params, defaults, { router, route, debounceMs: 0 }),
      );
      await nextTick();
      expect(params.items).toEqual([
        { name: "a", value: 1 },
        { name: "b", value: 99 },
      ]);
    });

    it("reset restores nested defaults", async () => {
      const { router, route } = makeRouterStub({ "nested.foo": "9" });
      const params = reactive({ nested: { foo: 1, bar: 2 } });
      const { api } = mountWith(() =>
        useUrlParams(
          params,
          { nested: { foo: 1, bar: 2 } },
          { router, route, debounceMs: 0 },
        ),
      );
      await nextTick();
      expect(params.nested.foo).toBe(9);
      api.reset();
      await nextTick();
      expect(params.nested).toEqual({ foo: 1, bar: 2 });
    });
  });

  describe("defaults variants", () => {
    it("accepts a Ref as defaults", async () => {
      const { router, route } = makeRouterStub({ a: "7" });
      const params = reactive({ a: 0 });
      const defaults = ref({ a: 0 });
      mountWith(() =>
        useUrlParams(params, defaults, { router, route, debounceMs: 0 }),
      );
      await nextTick();
      expect(params.a).toBe(7);
    });

    it("accepts a getter and hydrates lazily once defaults are ready", async () => {
      const { router, route } = makeRouterStub({ a: "7" });
      const params = reactive({ a: 0 });
      let ready: { a: number } | undefined = undefined;
      const { api } = mountWith(() =>
        useUrlParams(params, () => ready, {
          router,
          route,
          debounceMs: 0,
        }),
      );
      await nextTick();
      // getter returned undefined on mount — no hydration yet
      expect(params.a).toBe(0);
      ready = { a: 0 };
      expect(api.hydrate()).toBe(true);
      expect(params.a).toBe(7);
    });

    it("hydrate() returns false while defaults are unavailable", async () => {
      const { router, route } = makeRouterStub({ a: "7" });
      const params = reactive({ a: 0 });
      const { api } = mountWith(() =>
        useUrlParams(params, () => undefined as { a: number } | undefined, {
          router,
          route,
          debounceMs: 0,
        }),
      );
      await nextTick();
      expect(api.hydrate()).toBe(false);
      expect(params.a).toBe(0);
    });
  });

  describe("codecs", () => {
    it("round-trips a tagged-union field through a single URL key", async () => {
      const { router, route } = makeRouterStub();
      const defaults: { rate: InfectionRate; population: number } = {
        rate: { type: "constant", value: 0.5, duration: 3 },
        population: 10_000,
      };
      const params = reactive(structuredClone(defaults));
      mountWith(() =>
        useUrlParams(params, defaults, {
          router,
          route,
          debounceMs: 0,
          codecs: { rate: jsonCodec },
        }),
      );
      await nextTick();
      params.rate = {
        type: "empirical",
        points: [
          [0, 0],
          [2, 1],
          [4, 1.2],
        ],
      };
      await nextTick();
      await new Promise((r) => setTimeout(r, 5));
      expect(route.query).toEqual({ rate: JSON.stringify(params.rate) });
    });

    it("hydrates a codec-encoded variant from the URL", async () => {
      const variant: InfectionRate = {
        type: "empirical",
        points: [
          [0, 0],
          [2, 1],
        ],
      };
      const { router, route } = makeRouterStub({
        rate: JSON.stringify(variant),
      });
      const defaults: { rate: InfectionRate } = {
        rate: { type: "constant", value: 0.5, duration: 3 },
      };
      const params = reactive(structuredClone(defaults));
      mountWith(() =>
        useUrlParams(params, defaults, {
          router,
          route,
          debounceMs: 0,
          codecs: { rate: jsonCodec },
        }),
      );
      await nextTick();
      expect(params.rate).toEqual(variant);
    });

    it("ignores stale descendant URL keys at a codec path", async () => {
      // Pretend an older version stored `rate.value=0.9`; with a codec at
      // `rate` we must not punch that through into the variant.
      const { router, route } = makeRouterStub({ "rate.value": "0.9" });
      const defaults: { rate: InfectionRate } = {
        rate: { type: "constant", value: 0.5, duration: 3 },
      };
      const params = reactive(structuredClone(defaults));
      mountWith(() =>
        useUrlParams(params, defaults, {
          router,
          route,
          debounceMs: 0,
          codecs: { rate: jsonCodec },
        }),
      );
      await nextTick();
      expect(params.rate).toEqual({
        type: "constant",
        value: 0.5,
        duration: 3,
      });
    });

    it("reset clears a codec value from the URL", async () => {
      const variant: InfectionRate = {
        type: "empirical",
        points: [[0, 1]],
      };
      const { router, route } = makeRouterStub({
        rate: JSON.stringify(variant),
      });
      const defaults: { rate: InfectionRate } = {
        rate: { type: "constant", value: 0.5, duration: 3 },
      };
      const params = reactive(structuredClone(defaults));
      const { api } = mountWith(() =>
        useUrlParams(params, defaults, {
          router,
          route,
          debounceMs: 0,
          codecs: { rate: jsonCodec },
        }),
      );
      await nextTick();
      expect(params.rate).toEqual(variant);
      api.reset();
      await nextTick();
      expect(params.rate).toEqual({
        type: "constant",
        value: 0.5,
        duration: 3,
      });
      expect(route.query).toEqual({});
    });
  });
});

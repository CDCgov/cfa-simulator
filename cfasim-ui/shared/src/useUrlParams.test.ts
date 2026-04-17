import { describe, it, expect, vi } from "vitest";
import { defineComponent, h, ref, reactive, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import {
  serialize,
  deserialize,
  paramsToQuery,
  queryToParams,
  useUrlParams,
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
});

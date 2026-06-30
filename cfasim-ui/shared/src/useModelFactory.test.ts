import { describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { isReactive, reactive } from "vue";
import { createUseModel } from "./useModelFactory.js";
import type { ModelRuntime, RuntimeResult } from "./useModelFactory.js";

function fakeRuntime(initial?: { load?: RuntimeResult; run?: RuntimeResult }) {
  const state = {
    load: initial?.load ?? { result: true },
    run: initial?.run ?? ({ result: "ran" } as RuntimeResult),
  };
  const runtime: ModelRuntime = {
    load: vi.fn(async () => state.load),
    run: vi.fn(async () => state.run),
  };
  return { runtime, state };
}

describe("createUseModel", () => {
  it("starts loading and clears it once the model loads", async () => {
    const { runtime } = fakeRuntime();
    const { loading, error } = createUseModel(runtime)("m");
    expect(loading.value).toBe(true);
    await flushPromises();
    expect(loading.value).toBe(false);
    expect(error.value).toBeUndefined();
    expect(runtime.load).toHaveBeenCalledWith("m");
  });

  it("surfaces a load error", async () => {
    const { runtime } = fakeRuntime({ load: { error: "load boom" } });
    const { error, loading } = createUseModel(runtime)("m");
    await flushPromises();
    expect(error.value).toBe("load boom");
    expect(loading.value).toBe(false);
  });

  it("run() sets result and passes reactivity-stripped params", async () => {
    const { runtime } = fakeRuntime();
    const model = createUseModel(runtime)("m");
    await flushPromises();

    const params = reactive({ a: 1, b: 2 });
    await model.run("fn", params);

    expect(model.result.value).toBe("ran");
    expect(model.error.value).toBeUndefined();
    expect(model.loading.value).toBe(false);

    const passed = (runtime.run as any).mock.calls[0];
    expect(passed[0]).toBe("m");
    expect(passed[1]).toBe("fn");
    expect(passed[2]).toEqual({ a: 1, b: 2 });
    expect(isReactive(passed[2])).toBe(false);
  });

  it("run() surfaces a runtime error and a thrown exception", async () => {
    const { runtime, state } = fakeRuntime();
    const model = createUseModel(runtime)("m");
    await flushPromises();

    state.run = { error: "run boom" };
    await model.run("fn");
    expect(model.error.value).toBe("run boom");

    (runtime.run as any).mockImplementationOnce(async () => {
      throw new Error("explode");
    });
    await model.run("fn");
    expect(model.error.value).toBe("explode");
    expect(model.loading.value).toBe(false);
  });

  it("useOutputs runs immediately and re-runs when params change", async () => {
    const { runtime } = fakeRuntime({ run: { result: { series: 1 } } });
    const model = createUseModel(runtime)("m");
    const params = reactive({ steps: 1 });
    const { outputs, loading } = model.useOutputs("sim", params);

    expect(loading.value).toBe(true);
    await flushPromises();
    expect(loading.value).toBe(false);
    expect(runtime.run).toHaveBeenCalledWith("m", "sim", { steps: 1 });
    expect(outputs.value).toEqual({ series: 1 });

    params.steps = 2;
    await flushPromises();
    expect(runtime.run).toHaveBeenLastCalledWith("m", "sim", { steps: 2 });
  });

  it("useOutputs surfaces errors without throwing", async () => {
    const { runtime } = fakeRuntime({ run: { error: "sim failed" } });
    const model = createUseModel(runtime)("m");
    const { error, outputs, loading } = model.useOutputs(
      "sim",
      reactive({ steps: 1 }),
    );
    await flushPromises();
    expect(error.value).toBe("sim failed");
    expect(outputs.value).toBeUndefined();
    expect(loading.value).toBe(false);
  });
});

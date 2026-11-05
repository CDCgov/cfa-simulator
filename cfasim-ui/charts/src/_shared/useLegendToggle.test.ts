import { describe, it, expect, vi } from "vitest";
import { useLegendToggle } from "./useLegendToggle.js";

describe("useLegendToggle isolate", () => {
  const labels = ["A", "B", "C"];

  it("hides every other label, then restores all on a second click", () => {
    const onUpdate = vi.fn();
    const { isolate, isHidden } = useLegendToggle({
      hidden: () => undefined,
      onUpdate,
    });
    isolate("B", labels);
    expect(onUpdate).toHaveBeenLastCalledWith(["A", "C"]);
    expect(isHidden("A")).toBe(true);
    expect(isHidden("B")).toBe(false);
    isolate("B", labels);
    expect(onUpdate).toHaveBeenLastCalledWith([]);
  });

  it("switches to another label from an isolated state", () => {
    const onUpdate = vi.fn();
    const { isolate } = useLegendToggle({
      hidden: () => ["A", "C"],
      onUpdate,
    });
    isolate("A", labels);
    expect(onUpdate).toHaveBeenLastCalledWith(["B", "C"]);
  });
});

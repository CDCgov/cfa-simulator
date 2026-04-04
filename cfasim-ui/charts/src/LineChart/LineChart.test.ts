import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LineChart from "./LineChart.vue";

describe("LineChart", () => {
  it("renders a single series as a path", () => {
    const wrapper = mount(LineChart, {
      props: { data: [0, 10, 20], height: 100, menu: false },
    });
    const paths = wrapper.findAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(1);
    const dataPath = paths[paths.length - 1];
    expect(dataPath.attributes("d")).toBeTruthy();
    expect(dataPath.attributes("fill")).toBe("none");
  });

  it("renders multiple series as separate paths", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 5, 10] }, { data: [10, 5, 0] }],
        height: 100,
        menu: false,
      },
    });
    const paths = wrapper.findAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(2);
  });

  it("does not render dots by default", () => {
    const wrapper = mount(LineChart, {
      props: { data: [0, 10, 20], height: 100, menu: false },
    });
    expect(wrapper.findAll("circle").length).toBe(0);
  });

  it("renders dots when dots option is true", () => {
    const data = [0, 10, 20];
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data, dots: true }],
        height: 100,
        width: 200,
        menu: false,
      },
    });
    const circles = wrapper.findAll("circle");
    expect(circles.length).toBe(data.length);
  });

  it("skips dots for non-finite values", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, NaN, 20], dots: true }],
        height: 100,
        menu: false,
      },
    });
    expect(wrapper.findAll("circle").length).toBe(2);
  });

  it("applies dotRadius", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10], dots: true, dotRadius: 5 }],
        height: 100,
        menu: false,
      },
    });
    const circle = wrapper.find("circle");
    expect(circle.attributes("r")).toBe("5");
  });

  it("applies dotFill", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10], dots: true, dotFill: "red" }],
        height: 100,
        menu: false,
      },
    });
    const circle = wrapper.find("circle");
    expect(circle.attributes("fill")).toBe("red");
  });

  it("applies dotStroke", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10], dots: true, dotStroke: "#fff" }],
        height: 100,
        menu: false,
      },
    });
    const circle = wrapper.find("circle");
    expect(circle.attributes("stroke")).toBe("#fff");
  });

  it("defaults dotFill to series color", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10], dots: true, color: "#0057b7" }],
        height: 100,
        menu: false,
      },
    });
    const circle = wrapper.find("circle");
    expect(circle.attributes("fill")).toBe("#0057b7");
  });

  it("only renders dots for series with dots enabled", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10, 20], dots: true }, { data: [20, 10, 0] }],
        height: 100,
        menu: false,
      },
    });
    expect(wrapper.findAll("circle").length).toBe(3);
  });

  it("renders a line by default", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10, 20] }],
        height: 100,
        menu: false,
      },
    });
    expect(wrapper.findAll("path").length).toBe(1);
  });

  it("hides the line when line is false", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10, 20], line: false, dots: true }],
        height: 100,
        menu: false,
      },
    });
    expect(wrapper.findAll("path").length).toBe(0);
    expect(wrapper.findAll("circle").length).toBe(3);
  });

  it("applies per-series lineOpacity to stroke-opacity", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10, 20], lineOpacity: 0.3 }],
        height: 100,
        menu: false,
      },
    });
    const path = wrapper.find("path");
    expect(path.attributes("stroke-opacity")).toBe("0.3");
  });

  it("applies per-series dotOpacity to fill-opacity", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10], dots: true, dotOpacity: 0.5 }],
        height: 100,
        menu: false,
      },
    });
    const circle = wrapper.find("circle");
    expect(circle.attributes("fill-opacity")).toBe("0.5");
  });

  it("lineOpacity overrides series opacity for lines", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10, 20], opacity: 0.8, lineOpacity: 0.2 }],
        height: 100,
        menu: false,
      },
    });
    const path = wrapper.find("path");
    expect(path.attributes("stroke-opacity")).toBe("0.2");
  });

  it("dotOpacity overrides series opacity for dots", () => {
    const wrapper = mount(LineChart, {
      props: {
        series: [{ data: [0, 10], dots: true, opacity: 0.8, dotOpacity: 0.4 }],
        height: 100,
        menu: false,
      },
    });
    const circle = wrapper.find("circle");
    expect(circle.attributes("fill-opacity")).toBe("0.4");
  });

  it("renders tooltip overlay when tooltipTrigger is set", () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [0, 10, 20],
        height: 100,
        menu: false,
        tooltipTrigger: "hover" as const,
      },
    });
    const rects = wrapper.findAll("rect");
    const overlay = rects.find((r) => r.attributes("fill") === "transparent");
    expect(overlay).toBeTruthy();
  });

  it("does not render tooltip overlay without tooltipTrigger", () => {
    const wrapper = mount(LineChart, {
      props: { data: [0, 10, 20], height: 100, menu: false },
    });
    const rects = wrapper.findAll("rect");
    const overlay = rects.find((r) => r.attributes("fill") === "transparent");
    expect(overlay).toBeUndefined();
  });

  it("emits hover event on mousemove over overlay", async () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [0, 10, 20],
        width: 400,
        height: 100,
        menu: false,
        tooltipTrigger: "hover" as const,
      },
      attachTo: document.body,
    });
    const overlay = wrapper
      .findAll("rect")
      .find((r) => r.attributes("fill") === "transparent")!;
    await overlay.trigger("mousemove", { clientX: 200, clientY: 50 });
    expect(wrapper.emitted("hover")).toBeTruthy();
    expect(wrapper.emitted("hover")![0][0]).toHaveProperty("index");
    wrapper.unmount();
  });

  it("emits hover null on mouseleave", async () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [0, 10, 20],
        width: 400,
        height: 100,
        menu: false,
        tooltipTrigger: "hover" as const,
      },
      attachTo: document.body,
    });
    const overlay = wrapper
      .findAll("rect")
      .find((r) => r.attributes("fill") === "transparent")!;
    await overlay.trigger("mousemove", { clientX: 200, clientY: 50 });
    await overlay.trigger("mouseleave");
    const events = wrapper.emitted("hover")!;
    expect(events[events.length - 1][0]).toBeNull();
    wrapper.unmount();
  });
});

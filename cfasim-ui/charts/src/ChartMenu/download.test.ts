import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  canCopyToClipboard,
  copyCanvasPng,
  copySvg,
  prepareSvgForExport,
  svgToString,
} from "./download.js";

function mountSvg(html: string): SVGSVGElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  const svg = host.querySelector("svg") as SVGSVGElement;
  return svg;
}

describe("prepareSvgForExport", () => {
  let cleanup: HTMLElement[];

  beforeEach(() => {
    cleanup = [];
  });

  afterEach(() => {
    for (const el of cleanup) el.remove();
    document.documentElement.removeAttribute("style");
  });

  it("inlines inherited color and font-family on the clone root", () => {
    const wrapper = document.createElement("div");
    wrapper.style.color = "rgb(10, 20, 30)";
    wrapper.style.fontFamily = "Helvetica, sans-serif";
    wrapper.innerHTML = `<svg width="100" height="50"></svg>`;
    document.body.appendChild(wrapper);
    cleanup.push(wrapper);

    const svg = wrapper.querySelector("svg") as SVGSVGElement;
    const clone = prepareSvgForExport(svg);
    const style = clone.getAttribute("style") ?? "";

    expect(style).toContain("color: rgb(10, 20, 30)");
    expect(style.toLowerCase()).toContain("helvetica");
    expect(clone.getAttribute("xmlns")).toBe("http://www.w3.org/2000/svg");
  });

  it("preserves any existing inline style on the root", () => {
    const wrapper = document.createElement("div");
    wrapper.style.color = "rgb(1, 2, 3)";
    wrapper.innerHTML = `<svg width="100" height="50" style="overflow: visible"></svg>`;
    document.body.appendChild(wrapper);
    cleanup.push(wrapper);

    const svg = wrapper.querySelector("svg") as SVGSVGElement;
    const clone = prepareSvgForExport(svg);
    const style = clone.getAttribute("style") ?? "";

    expect(style).toContain("overflow: visible");
    expect(style).toContain("color: rgb(1, 2, 3)");
  });

  it("resolves var() references in fill and stroke attributes", () => {
    document.documentElement.style.setProperty("--my-fill", "rgb(255, 0, 0)");
    document.documentElement.style.setProperty("--my-stroke", "rgb(0, 128, 0)");

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <svg width="100" height="50">
        <rect fill="var(--my-fill)" stroke="var(--my-stroke)" />
        <circle fill="rgb(0, 0, 255)" />
      </svg>
    `;
    document.body.appendChild(wrapper);
    cleanup.push(wrapper);

    const svg = wrapper.querySelector("svg") as SVGSVGElement;
    const clone = prepareSvgForExport(svg);

    const rect = clone.querySelector("rect") as SVGRectElement;
    expect(rect.getAttribute("fill")).toBe("rgb(255, 0, 0)");
    expect(rect.getAttribute("stroke")).toBe("rgb(0, 128, 0)");

    // Non-var attributes are left untouched.
    const circle = clone.querySelector("circle") as SVGCircleElement;
    expect(circle.getAttribute("fill")).toBe("rgb(0, 0, 255)");
  });

  it("does not mutate the original svg", () => {
    document.documentElement.style.setProperty("--my-fill", "rgb(255, 0, 0)");

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<svg><rect fill="var(--my-fill)" /></svg>`;
    document.body.appendChild(wrapper);
    cleanup.push(wrapper);

    const svg = wrapper.querySelector("svg") as SVGSVGElement;
    prepareSvgForExport(svg);

    const rect = svg.querySelector("rect") as SVGRectElement;
    expect(rect.getAttribute("fill")).toBe("var(--my-fill)");
  });

  it("paints a background rect behind the chart when asked", () => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<svg><circle r="1" /></svg>`;
    document.body.appendChild(wrapper);
    cleanup.push(wrapper);

    const svg = wrapper.querySelector("svg") as SVGSVGElement;
    expect(prepareSvgForExport(svg).querySelector("rect")).toBeNull();

    const clone = prepareSvgForExport(svg, { background: "#123456" });
    const first = clone.firstElementChild as SVGElement;
    expect(first.tagName.toLowerCase()).toBe("rect");
    expect(first.getAttribute("fill")).toBe("#123456");
    expect(first.getAttribute("width")).toBe("100%");
    expect(svg.querySelector("rect")).toBeNull();
  });
});

describe("svgToString", () => {
  it("serializes the standalone clone", () => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<svg width="10" height="10"><circle r="1" /></svg>`;
    document.body.appendChild(wrapper);

    const svg = wrapper.querySelector("svg") as SVGSVGElement;
    const xml = svgToString(svg, { background: "white" });
    expect(xml).toMatch(/^<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(xml).toContain('fill="white"');
    expect(xml).toContain("<circle");
    wrapper.remove();
  });
});

describe("clipboard", () => {
  // A fake ClipboardItem exposes the values as given, so the tests can tell a
  // promise-valued PNG from a resolved one.
  class FakeClipboardItem {
    static supported: string[] = [];
    constructor(public data: Record<string, Blob | Promise<Blob>>) {}
    static supports(type: string) {
      return FakeClipboardItem.supported.includes(type);
    }
  }
  const write = vi.fn<(items: FakeClipboardItem[]) => Promise<void>>();

  beforeEach(() => {
    FakeClipboardItem.supported = [];
    write.mockReset().mockResolvedValue();
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    Object.defineProperty(navigator, "clipboard", {
      value: { write },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (navigator as { clipboard?: unknown }).clipboard;
  });

  function writtenData(call = 0) {
    return write.mock.calls[call][0][0].data;
  }

  it("canCopyToClipboard needs the async Clipboard API", () => {
    expect(canCopyToClipboard()).toBe(true);
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    expect(canCopyToClipboard()).toBe(false);
  });

  it("copySvg writes the standalone markup as text, plus image/svg+xml when supported", async () => {
    const host = document.createElement("div");
    host.innerHTML = `<svg width="10" height="10"><circle r="1" fill="var(--nope, red)" /></svg>`;
    document.body.appendChild(host);
    const svg = host.querySelector("svg") as SVGSVGElement;

    await copySvg(svg);
    expect(Object.keys(writtenData())).toEqual(["text/plain"]);
    const text = await (writtenData()["text/plain"] as Blob).text();
    expect(text).toMatch(/^<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(text).toContain('fill="red"');

    FakeClipboardItem.supported = ["image/svg+xml"];
    await copySvg(svg);
    const data = writtenData(1);
    expect(Object.keys(data)).toEqual(["text/plain", "image/svg+xml"]);
    expect(await (data["image/svg+xml"] as Blob).text()).toBe(text);
    host.remove();
  });

  it("copyCanvasPng passes the PNG as a promise, then as a blob if the browser rejects promises", async () => {
    const png = new Blob(["png"], { type: "image/png" });
    const canvas = document.createElement("canvas");
    canvas.toBlob = (callback) => callback(png);

    await copyCanvasPng(canvas);
    expect(write).toHaveBeenCalledOnce();
    expect(writtenData()["image/png"]).toBeInstanceOf(Promise);
    expect(await writtenData()["image/png"]).toBe(png);

    write.mockRejectedValueOnce(new TypeError("no promise values"));
    await copyCanvasPng(canvas);
    expect(write).toHaveBeenCalledTimes(3);
    expect(writtenData(2)["image/png"]).toBe(png);
  });
});

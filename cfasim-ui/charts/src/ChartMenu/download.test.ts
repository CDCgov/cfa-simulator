import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  canCopyToClipboard,
  copyCanvasPng,
  copySvg,
  prepareSvgForExport,
  svgToString,
} from "./download.js";

describe("prepareSvgForExport and svgToString", () => {
  let host: HTMLElement;

  afterEach(() => {
    host?.remove();
    document.documentElement.removeAttribute("style");
  });

  it("inlines inherited styles, resolves var() without mutating source, and defaults to transparent", () => {
    document.documentElement.style.setProperty("--my-fill", "rgb(255, 0, 0)");
    host = document.createElement("div");
    host.style.color = "rgb(10, 20, 30)";
    host.style.fontFamily = "Helvetica, sans-serif";
    host.innerHTML = `<svg width="100" height="50" style="overflow: visible"><rect fill="var(--my-fill)" /></svg>`;
    document.body.appendChild(host);

    const svg = host.querySelector("svg") as SVGSVGElement;
    const clone = prepareSvgForExport(svg);
    const style = clone.getAttribute("style") ?? "";

    expect(clone.getAttribute("xmlns")).toBe("http://www.w3.org/2000/svg");
    expect(style).toContain("overflow: visible");
    expect(style).toContain("color: rgb(10, 20, 30)");
    expect(clone.querySelector("rect")!.getAttribute("fill")).toBe(
      "rgb(255, 0, 0)",
    );
    expect(svg.querySelector("rect")!.getAttribute("fill")).toBe(
      "var(--my-fill)",
    );
    expect(clone.firstElementChild!.getAttribute("width")).toBeNull();
  });

  it("paints a background rect only when requested and serializes via svgToString", () => {
    host = document.createElement("div");
    host.innerHTML = `<svg width="10" height="10"><circle r="1" /></svg>`;
    document.body.appendChild(host);
    const svg = host.querySelector("svg") as SVGSVGElement;

    expect(prepareSvgForExport(svg).querySelector("rect")).toBeNull();
    const xml = svgToString(svg, { background: "#123456" });
    expect(xml).toMatch(/^<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(xml).toContain('fill="#123456"');
    expect(svg.querySelector("rect")).toBeNull();
  });
});

describe("clipboard", () => {
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

  it("checks availability, copies SVG, and falls back to Blob when PNG Promise write rejects", async () => {
    expect(canCopyToClipboard()).toBe(true);

    const host = document.createElement("div");
    host.innerHTML = `<svg width="10" height="10"><circle r="1" fill="var(--nope, red)" /></svg>`;
    document.body.appendChild(host);
    const svg = host.querySelector("svg") as SVGSVGElement;

    FakeClipboardItem.supported = ["image/svg+xml"];
    await copySvg(svg);
    const svgData = write.mock.calls[0][0][0].data;
    expect(Object.keys(svgData)).toEqual(["text/plain", "image/svg+xml"]);
    expect(await (svgData["text/plain"] as Blob).text()).toContain(
      'fill="red"',
    );
    host.remove();

    const png = new Blob(["png"], { type: "image/png" });
    const canvas = document.createElement("canvas");
    canvas.toBlob = (callback) => callback(png);
    write.mockRejectedValueOnce(new TypeError("no promise values"));
    await copyCanvasPng(canvas);
    expect(write.mock.calls[1][0][0].data["image/png"]).toBeInstanceOf(Promise);
    expect(write.mock.calls[2][0][0].data["image/png"]).toBe(png);
  });
});

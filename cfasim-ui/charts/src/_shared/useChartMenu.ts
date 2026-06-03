import { computed, ref, type Ref } from "vue";
import type { ChartMenuItem } from "../ChartMenu/ChartMenu.vue";
import { saveSvg, savePng, downloadCsv } from "../ChartMenu/download.js";
import { useChartFullscreen } from "./useChartFullscreen.js";

export interface ChartMenuOptions {
  filename: () => string | undefined;
  /** Used as the menu's filename fallback when `filename` is unset. */
  legacyMenuLabel: () => boolean | string | undefined;
  /** Builds the CSV content for downloads. */
  getCsv: () => string;
  /** Whether a separate download link is rendered (and the CSV menu item should be hidden). */
  downloadLink: () => boolean | string | undefined;
  /** Whether a separate download button is rendered (and the CSV menu item should be hidden). */
  downloadButton?: () => boolean | string | undefined;
  /**
   * When true, prepends a Fullscreen menu item that toggles the chart
   * into a full-window view. The consumer binds the returned
   * `isFullscreen` class plus `fullscreenStyle` to its wrapper and wraps
   * it in a `<Teleport :to="teleportTarget" :disabled="!isFullscreen">`.
   */
  fullscreen?: boolean;
  /** Forwarded to `useChartFullscreen` — see its `target` option. */
  fullscreenTarget?: () => string | HTMLElement | undefined;
}

/**
 * Computes the standard chart menu items (Fullscreen / SVG / PNG / CSV) plus
 * the CSV-download-link state shared by every chart.
 */
export function useChartMenu(opts: ChartMenuOptions) {
  const svgRef = ref<SVGSVGElement | null>(null);

  function resolvedFilename(): string {
    const f = opts.filename();
    if (f) return f;
    const menu = opts.legacyMenuLabel();
    return typeof menu === "string" ? menu : "chart";
  }

  const fullscreen = opts.fullscreen
    ? useChartFullscreen({ target: opts.fullscreenTarget })
    : null;

  const items = computed<ChartMenuItem[]>(() => {
    const fname = resolvedFilename();
    const out: ChartMenuItem[] = [];
    if (fullscreen) {
      out.push(fullscreen.menuItem.value);
    }
    out.push(
      {
        label: "Save as SVG",
        action: () => {
          if (svgRef.value) saveSvg(svgRef.value, fname);
        },
      },
      {
        label: "Save as PNG",
        action: () => {
          if (svgRef.value) savePng(svgRef.value, fname);
        },
      },
    );
    const buttonOn = opts.downloadButton?.();
    if (!opts.downloadLink() && !buttonOn) {
      out.push({
        label: "Download CSV",
        action: () => downloadCsv(opts.getCsv(), fname),
      });
    }
    return out;
  });

  const downloadLinkText = computed<string | null>(() => {
    if (opts.downloadButton?.()) return null;
    const v = opts.downloadLink();
    if (!v) return null;
    return typeof v === "string" ? v : "Download data (CSV)";
  });

  const csvHref = computed<string | null>(() => {
    if (opts.downloadButton?.()) return null;
    if (!opts.downloadLink()) return null;
    return `data:text/csv;charset=utf-8,${encodeURIComponent(opts.getCsv())}`;
  });

  const downloadButtonText = computed<string | null>(() => {
    const v = opts.downloadButton?.();
    if (!v) return null;
    return typeof v === "string" ? v : "Download data (CSV)";
  });

  function triggerCsvDownload() {
    downloadCsv(opts.getCsv(), resolvedFilename());
  }

  return {
    svgRef: svgRef as Ref<SVGSVGElement | null>,
    items,
    downloadLinkText,
    csvHref,
    downloadButtonText,
    triggerCsvDownload,
    resolvedFilename,
    isFullscreen: fullscreen?.isFullscreen ?? ref(false),
    fullscreenStyle: fullscreen?.fullscreenStyle ?? computed(() => undefined),
    teleportTarget: fullscreen?.teleportTarget ?? computed(() => "body"),
    exitFullscreen: fullscreen?.exit ?? (() => {}),
  };
}

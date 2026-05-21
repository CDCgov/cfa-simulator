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
  /**
   * When true, prepends an Expand/Collapse menu item that toggles the
   * chart into a full-window view. The consumer is responsible for
   * binding the returned `isFullscreen` ref to a CSS class on its
   * wrapper.
   */
  fullscreen?: boolean;
}

/**
 * Computes the standard chart menu items (Expand / SVG / PNG / CSV) plus
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

  const fullscreen = opts.fullscreen ? useChartFullscreen() : null;

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
    if (!opts.downloadLink()) {
      out.push({
        label: "Download CSV",
        action: () => downloadCsv(opts.getCsv(), fname),
      });
    }
    return out;
  });

  const downloadLinkText = computed<string | null>(() => {
    const v = opts.downloadLink();
    if (!v) return null;
    return typeof v === "string" ? v : "Download data (CSV)";
  });

  const csvHref = computed<string | null>(() => {
    if (!opts.downloadLink()) return null;
    return `data:text/csv;charset=utf-8,${encodeURIComponent(opts.getCsv())}`;
  });

  return {
    svgRef: svgRef as Ref<SVGSVGElement | null>,
    items,
    downloadLinkText,
    csvHref,
    resolvedFilename,
    isFullscreen: fullscreen?.isFullscreen ?? ref(false),
  };
}

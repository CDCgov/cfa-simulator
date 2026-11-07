import { computed, nextTick, onScopeDispose, ref, type Ref } from "vue";
import type { ChartMenuItem } from "../ChartMenu/ChartMenu.vue";
import {
  copyCanvasPng,
  copyPng,
  copySvg,
  downloadCsv,
  saveCanvasPng,
  savePng,
  saveSvg,
} from "../ChartMenu/download.js";
import { useChartFullscreen } from "./useChartFullscreen.js";
import type { ChartMenuItemKey } from "./chartProps.js";

const COPY_ANNOUNCEMENT_MS = 2000;

/**
 * Reports a clipboard copy through the chart's polite live region: the menu
 * closes on the click, so the announcement is the only feedback. `copy` runs
 * `action` and announces "<what> copied to clipboard" or a failure.
 */
export function useCopyFeedback() {
  const announcement = ref("");
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function announce(text: string) {
    // Clear first so a repeat of the same message is announced again.
    announcement.value = "";
    await nextTick();
    announcement.value = text;
    clearTimeout(timer);
    timer = setTimeout(() => (announcement.value = ""), COPY_ANNOUNCEMENT_MS);
  }

  async function copy(action: () => Promise<void>, what: string) {
    try {
      await action();
      await announce(`${what} copied to clipboard`);
    } catch (error) {
      console.warn(`Could not copy the ${what} to the clipboard`, error);
      await announce("Could not copy to clipboard");
    }
  }

  onScopeDispose(() => clearTimeout(timer));

  return { announcement, copy };
}

/** `show(key)` for a `menuItems` prop: every item when the prop is unset. */
export function menuItemFilter(wanted: ChartMenuItemKey[] | undefined) {
  return (key: ChartMenuItemKey) => !wanted || wanted.includes(key);
}

export interface ExportMenuSource {
  /** Filename (without extension) for the save items. */
  filename: string;
  /** Names the copied thing in the live region, e.g. "Chart" or "Map". */
  subject: string;
  show: (key: ChartMenuItemKey) => boolean;
  /** `useCopyFeedback().copy`. */
  copy: (action: () => Promise<void>, what: string) => Promise<void>;
  svg: () => SVGSVGElement | null;
  /**
   * A canvas-rendered chart: its PNG items read the canvas (already sized
   * at devicePixelRatio) and it has no SVG to offer, so the SVG items are
   * left out.
   */
  canvas?: () => HTMLCanvasElement | null;
}

/** A menu action that runs `run` on the element, when it is there. */
function withElement<T>(get: () => T | null, run: (el: T) => void) {
  return () => {
    const el = get();
    if (el) run(el);
  };
}

/** The Save PNG, Copy PNG, Save SVG, Copy SVG items, in that order. ChartMenu
 *  drops the copy items where the clipboard is unavailable. */
export function exportMenuItems(source: ExportMenuSource): ChartMenuItem[] {
  const { filename, subject, show, copy, svg, canvas } = source;
  const items: ChartMenuItem[] = [];
  if (show("save-png")) {
    items.push({
      label: "Save PNG",
      icon: "image",
      action: canvas
        ? withElement(canvas, (el) => void saveCanvasPng(el, filename))
        : withElement(svg, (el) => void savePng(el, filename)),
    });
  }
  if (show("copy-png")) {
    const what = `${subject} PNG`;
    items.push({
      label: "Copy PNG",
      icon: "copy",
      needsClipboard: true,
      action: canvas
        ? withElement(canvas, (el) => void copy(() => copyCanvasPng(el), what))
        : withElement(svg, (el) => void copy(() => copyPng(el), what)),
    });
  }
  if (canvas) return items;
  if (show("save-svg")) {
    items.push({
      label: "Save SVG",
      icon: "vector",
      action: withElement(svg, (el) => saveSvg(el, filename)),
    });
  }
  if (show("copy-svg")) {
    items.push({
      label: "Copy SVG",
      icon: "copy",
      needsClipboard: true,
      action: withElement(
        svg,
        (el) => void copy(() => copySvg(el), `${subject} SVG`),
      ),
    });
  }
  return items;
}

export interface ChartMenuOptions {
  filename: () => string | undefined;
  /** Which items to offer; every item when unset. */
  menuItems?: () => ChartMenuItemKey[] | undefined;
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
 * Computes the standard chart menu items (Fullscreen, copy and save as SVG
 * and PNG, Download CSV) plus the CSV-download-link state shared by every
 * chart.
 */
export function useChartMenu(opts: ChartMenuOptions) {
  const svgRef = ref<SVGSVGElement | null>(null);
  const { announcement, copy } = useCopyFeedback();

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
    const show = menuItemFilter(opts.menuItems?.());
    const out: ChartMenuItem[] = [];
    if (fullscreen && show("fullscreen")) {
      out.push(fullscreen.menuItem.value);
    }
    out.push(
      ...exportMenuItems({
        filename: fname,
        subject: "Chart",
        show,
        copy,
        svg: () => svgRef.value,
      }),
    );
    const buttonOn = opts.downloadButton?.();
    if (show("csv") && !opts.downloadLink() && !buttonOn) {
      out.push({
        label: "Download CSV",
        icon: "file",
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
    /** Live-region text reporting a clipboard copy; empty otherwise. */
    announcement,
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

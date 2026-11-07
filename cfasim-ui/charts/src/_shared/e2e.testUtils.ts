import type { Locator } from "@playwright/test";

/**
 * Scrolls to a target for tests that use raw mouse coordinates. The docs dev
 * server starts loading Inter only after the first layout, and the swap
 * re-wraps every paragraph on the page, which can move a chart by hundreds of
 * pixels after it was measured. Scroll again once the fonts are in.
 */
export async function scrollIntoSettledView(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  await target.page().evaluate(() => document.fonts.ready);
  await target.scrollIntoViewIfNeeded();
}

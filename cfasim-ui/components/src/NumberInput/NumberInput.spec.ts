import { test, expect } from "@playwright/test";
import type { Locator } from "@playwright/test";

// The dev server loads Inter after the first layout, and the swap moves the
// page under raw mouse coordinates; scroll again once the fonts are in.
async function scrollIntoSettledView(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  await target.page().evaluate(() => document.fonts.ready);
  await target.scrollIntoViewIfNeeded();
}

test("NumberInput page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/components/number-input");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(demos.first().getByText("Days")).toBeVisible();
  await expect(demos.first().locator('input[type="text"]')).toBeVisible();
});

// Scope to the field's root: one .demo-preview can hold several sliders.
function field(page: import("@playwright/test").Page, label: string) {
  return page.locator(".demo-preview .cfasim-input-label", {
    hasText: label,
  });
}

// A <label> wrapping the slider made the Hint button its labeled control,
// so a track click focused the button and opened the tooltip (Chrome,
// Firefox).
test("using the slider leaves the hint closed", async ({ page }) => {
  await page.goto("./cfasim-ui/components/number-input");
  const r0 = field(page, "R0");
  const hint = r0.locator(".HintTrigger");
  await expect(hint).toHaveAttribute("data-state", "closed");
  const thumb = r0.locator(".slider-thumb");
  await expect(thumb).toHaveAttribute("aria-valuenow", /\d/);
  const before = await thumb.getAttribute("aria-valuenow");
  const track = r0.locator(".slider-track");
  await scrollIntoSettledView(track);
  const box = await track.boundingBox();
  if (!box) throw new Error("no track");
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
  await expect(thumb).not.toHaveAttribute("aria-valuenow", before ?? "");
  await expect(thumb).toBeFocused();
  await expect(hint).toHaveAttribute("data-state", "closed");
  await expect(page.locator(".HintContent")).toHaveCount(0);
});

test("clicking the % suffix focuses the input", async ({ page }) => {
  await page.goto("./cfasim-ui/components/number-input");
  const coverage = field(page, "Vaccination coverage");
  await coverage.locator(".input-suffix").click();
  await expect(coverage.locator("input")).toBeFocused();
});

test("segmented bar paints one band per handle", async ({ page }) => {
  await page.goto("./cfasim-ui/components/number-input");
  const segmented = field(page, "Segments");
  await expect(segmented.locator(".slider-thumb")).toHaveCount(3);
  await expect(segmented.locator(".slider-segment")).toHaveCount(3);
  await expect(segmented.locator(".slider-range")).toHaveCount(0);

  // bar="none" paints neither fill.
  const plain = field(page, "No bar");
  await expect(plain.locator(".slider-thumb")).toHaveCount(1);
  await expect(plain.locator(".slider-segment")).toHaveCount(0);
  await expect(plain.locator(".slider-range")).toHaveCount(0);

  // color-mix() in a custom property has to resolve to a real color.
  const bg = await segmented
    .locator(".slider-segment")
    .last()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toMatch(/^(rgba?|color)\(/);
  // An unresolvable value computes to transparent, which still matches above.
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
});

test("handle-colors paints each handle", async ({ page }) => {
  await page.goto("./cfasim-ui/components/number-input");
  const thumbs = field(page, "Risk tiers").locator(".slider-thumb");
  await expect(thumbs).toHaveCount(3);
  const colors = await thumbs.evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).backgroundColor),
  );
  expect(new Set(colors).size).toBe(3);
  for (const c of colors) expect(c).not.toBe("rgba(0, 0, 0, 0)");
});

test("keyboard moves a middle handle and repaints its segments", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/number-input");
  const segmented = field(page, "Segments");
  const thumbs = segmented.locator(".slider-thumb");
  await expect(thumbs.nth(1)).toContainText("45");

  const widthOf = async (i: number) =>
    segmented
      .locator(".slider-segment")
      .nth(i)
      .evaluate((el) => (el as HTMLElement).style.width);
  expect(await widthOf(1)).toBe("25%");

  await thumbs.nth(1).focus();
  await page.keyboard.press("ArrowRight");

  await expect(thumbs.nth(1)).toContainText("46");
  expect(await widthOf(1)).toBe("26%");
  // The band after it shrinks by the same amount; the first is untouched.
  expect(await widthOf(0)).toBe("20%");
  expect(await widthOf(2)).toBe("24%");
});

test("multi-handle slider exposes group and per-thumb ARIA", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/number-input");
  const cutpoints = field(page, "Age cutpoints");
  const group = cutpoints.locator(".slider-root");
  await expect(group).toHaveAttribute("role", "group");
  await expect(group).toHaveAttribute("aria-label", "Age cutpoints");

  const thumbs = cutpoints.locator(".slider-thumb");
  await expect(thumbs).toHaveCount(3);
  await expect(thumbs.nth(1)).toHaveAttribute("role", "slider");
  await expect(thumbs.nth(1)).toHaveAttribute("aria-valuenow", "40");
  await expect(thumbs.nth(1)).toHaveAttribute(
    "aria-label",
    "Age cutpoints (handle 2 of 3)",
  );
  // Every thumb is individually focusable.
  await expect(thumbs.nth(2)).toHaveAttribute("tabindex", "0");

  // A percent slider must announce "20%", not the raw 0.2 in aria-valuenow.
  const coverage = field(page, "Coverage range").first();
  const covThumb = coverage.locator(".slider-thumb").first();
  await expect(covThumb).toHaveAttribute("aria-valuenow", "0.2");
  await expect(covThumb).toHaveAttribute("aria-valuetext", "20%");
});

test("disabled ranges block drags and keyboard steps", async ({ page }) => {
  await page.goto("./cfasim-ui/components/number-input");
  const season = field(page, "Season window");
  const mask = await season
    .locator(".slider-track")
    .evaluate((el) => getComputedStyle(el).maskImage);
  expect(mask).toContain("linear-gradient");
  await expect(season.locator(".slider-blocked")).toHaveCount(3);
  const thumbs = season.locator(".slider-thumb");
  await expect(thumbs.first()).toHaveAttribute("aria-valuemin", "20");
  await expect(thumbs.first()).toHaveAttribute("aria-valuemax", "90");

  // Home targets 0, inside the first blocked stretch.
  await thumbs.first().focus();
  await page.keyboard.press("Home");
  await expect(thumbs.first()).toHaveAttribute("aria-valuenow", "20");
  await page.keyboard.press("ArrowLeft");
  await expect(thumbs.first()).toHaveAttribute("aria-valuenow", "20");

  // The upper handle starts at 70; stepping down past 60 jumps to 40.
  await thumbs.nth(1).focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowLeft");
  await expect(thumbs.nth(1)).toHaveAttribute("aria-valuenow", "60");
  await page.keyboard.press("ArrowLeft");
  await expect(thumbs.nth(1)).toHaveAttribute("aria-valuenow", "40");
  await page.keyboard.press("ArrowRight");
  await expect(thumbs.nth(1)).toHaveAttribute("aria-valuenow", "60");

  // A drag released near 47 lands on the near edge of the middle stretch.
  const track = season.locator(".slider-track");
  await scrollIntoSettledView(track);
  const box = (await track.boundingBox())!;
  const thumbBox = (await thumbs.nth(1).boundingBox())!;
  await page.mouse.move(
    thumbBox.x + thumbBox.width / 2,
    thumbBox.y + thumbBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.47, box.y + box.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(thumbs.nth(1)).toHaveAttribute("aria-valuenow", "40");
});

test("crowded handle labels stay inside the field without overlapping", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/number-input#crowded-labels");
  const slider = field(page, "Calibration / forecast period");
  const thumbs = slider.getByRole("slider");
  await expect(thumbs).toHaveCount(4);

  const check = async () => {
    const { box, labels, centers } = await slider
      .locator(".slider-container")
      .evaluate((el) => ({
        box: el.getBoundingClientRect().toJSON(),
        labels: [...el.querySelectorAll(".slider-current")].map((l) =>
          l.getBoundingClientRect().toJSON(),
        ),
        centers: [...el.querySelectorAll(".slider-thumb")].map((t) => {
          const r = t.getBoundingClientRect();
          return r.left + r.width / 2;
        }),
      }));
    for (const [i, a] of labels.entries()) {
      // Each label still spans its own handle.
      expect(a.left).toBeLessThanOrEqual(centers[i] + 0.5);
      expect(a.right).toBeGreaterThanOrEqual(centers[i] - 0.5);
      expect(a.left).toBeGreaterThanOrEqual(box.left - 0.5);
      expect(a.right).toBeLessThanOrEqual(box.right + 0.5);
      expect(a.top).toBeGreaterThanOrEqual(box.top - 0.5);
      for (const b of labels.slice(i + 1)) {
        const apart =
          a.right <= b.left + 0.5 ||
          b.right <= a.left + 0.5 ||
          a.bottom <= b.top + 0.5 ||
          b.bottom <= a.top + 0.5;
        expect(apart).toBe(true);
      }
    }
  };

  // The first two handles start close enough to stack.
  await check();
  // Push the third handle onto the fourth at the track's max.
  await thumbs.nth(2).focus();
  await page.keyboard.press("End");
  await check();

  // A drag that crowds labels into a new row must not move the track under
  // the pointer; the row appears on release.
  await page.keyboard.press("Home");
  await check();
  const track = slider.locator(".slider-track");
  await scrollIntoSettledView(track);
  const trackY = (await track.boundingBox())!.y;
  const from = (await thumbs.nth(1).boundingBox())!;
  const to = (await thumbs.nth(2).boundingBox())!;
  const y = from.y + from.height / 2;
  await page.mouse.move(from.x + from.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width + 2, y, { steps: 10 });
  expect((await track.boundingBox())!.y).toBe(trackY);
  await page.mouse.up();
  await check();
});

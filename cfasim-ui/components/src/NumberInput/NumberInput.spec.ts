import { test, expect } from "@playwright/test";

test("NumberInput page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/components/number-input");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(demos.first().getByText("Days")).toBeVisible();
  await expect(demos.first().locator('input[type="text"]')).toBeVisible();
});

// Each field's root is the <label>, so scope to it — one .demo-preview can
// hold several sliders.
function field(page: import("@playwright/test").Page, label: string) {
  return page.locator(".demo-preview label.cfasim-input-label", {
    hasText: label,
  });
}

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

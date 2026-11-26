import { test, expect, type Locator, type Page } from "@playwright/test";

async function scrollIntoSettledView(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  await target.page().evaluate(() => document.fonts.ready);
  await target.scrollIntoViewIfNeeded();
}

function field(page: Page, label: string) {
  return page.locator(".demo-preview .cfasim-input-label", { hasText: label });
}

test("segmented bar resolves color-mix() to a real background color", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/number-input");
  const segmented = field(page, "Segments");
  const background = await segmented
    .locator(".slider-segment")
    .last()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).toMatch(/^(rgba?|color)\(/);
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
});

test("disabled ranges mask the track and block drags and keyboard steps", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/number-input");
  const season = field(page, "Season window");
  const mask = await season
    .locator(".slider-track")
    .evaluate((element) => getComputedStyle(element).maskImage);
  expect(mask).toContain("linear-gradient");

  const thumbs = season.locator(".slider-thumb");
  await thumbs.first().focus();
  await page.keyboard.press("Home");
  await expect(thumbs.first()).toHaveAttribute("aria-valuenow", "20");

  // Stepping down past 60 jumps over the blocked stretch to 40.
  await thumbs.nth(1).focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowLeft");
  await expect(thumbs.nth(1)).toHaveAttribute("aria-valuenow", "60");
  await page.keyboard.press("ArrowLeft");
  await expect(thumbs.nth(1)).toHaveAttribute("aria-valuenow", "40");

  // Dragging into the middle blocked stretch snaps to its near edge.
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

  const checkLayout = async () => {
    const { box, labels, centers } = await slider
      .locator(".slider-container")
      .evaluate((element) => ({
        box: element.getBoundingClientRect().toJSON(),
        labels: [...element.querySelectorAll(".slider-current")].map((label) =>
          label.getBoundingClientRect().toJSON(),
        ),
        centers: [...element.querySelectorAll(".slider-thumb")].map((thumb) => {
          const rect = thumb.getBoundingClientRect();
          return rect.left + rect.width / 2;
        }),
      }));
    for (const [i, labelA] of labels.entries()) {
      expect(labelA.left).toBeLessThanOrEqual(centers[i] + 0.5);
      expect(labelA.right).toBeGreaterThanOrEqual(centers[i] - 0.5);
      expect(labelA.left).toBeGreaterThanOrEqual(box.left - 0.5);
      expect(labelA.right).toBeLessThanOrEqual(box.right + 0.5);
      for (const labelB of labels.slice(i + 1)) {
        const apart =
          labelA.right <= labelB.left + 0.5 ||
          labelB.right <= labelA.left + 0.5 ||
          labelA.bottom <= labelB.top + 0.5 ||
          labelB.bottom <= labelA.top + 0.5;
        expect(apart).toBe(true);
      }
    }
  };

  await checkLayout();
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
  await checkLayout();
});

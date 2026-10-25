import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.skip(
  process.env.READER_TEST_MANIFEST !== "1",
  "Private supplied book acceptance; fixture CI does not contain private media.",
);
test("restored Manifest guest library, real word following, chapter boundaries and both PDFs", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.locator(".featured-book").first()).toContainText(
    "Manifest in Action",
  );
  await page.screenshot({
    path: info.outputPath("manifest-library.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open book", exact: true }).first().click();
  await expect(page.locator(".ebook-heading")).toContainText("Chapter 5 of 19");
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect(page.locator("body")).toHaveClass(/focus-reading/);
  await expect
    .poll(() =>
      page
        .locator(".ebook-paper")
        .evaluate((e) => e.scrollHeight <= e.clientHeight + 2),
    )
    .toBe(true);
  await expect
    .poll(async () => {
      const first = await page.locator("[data-fragment]").first().boundingBox();
      const paper = await page.locator(".ebook-paper").boundingBox();
      return (
        !!first &&
        !!paper &&
        first.y >= paper.y &&
        first.y + first.height <= paper.y + paper.height
      );
    })
    .toBe(true);
  await page.screenshot({
    path: info.outputPath("manifest-introduction-fullscreen.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  const firstMenu = page.getByRole("button", { name: "Open library menu" });
  if (await firstMenu.isVisible()) await firstMenu.click();
  await page
    .getByRole("navigation", { name: "Book chapters" })
    .getByRole("button")
    .first()
    .click();
  await expect(page.locator(".ebook-heading")).toContainText("Chapter 1 of 19");
  await page
    .getByRole("button", { name: "Play narration", exact: true })
    .click();
  await expect(page.locator(".spoken-word")).not.toHaveCount(0, {
    timeout: 15000,
  });
  await page
    .getByRole("button", { name: "Pause narration", exact: true })
    .click();
  const actual = await (
    await page.request.get("/books/manifest/book.json")
  ).json();
  const lateCue = actual.chapters[0].segments[3].words[0];
  await page
    .getByLabel("Chapter playback position")
    .fill(String(Math.round((lateCue.start + 0.02) * 10) / 10));
  await expect(page.locator(".spoken-word")).not.toHaveCount(0);
  const visibleWord = await page.locator(".spoken-word").first().boundingBox();
  const paperBounds = await page.locator(".ebook-paper").boundingBox();
  expect(visibleWord!.y).toBeGreaterThanOrEqual(paperBounds!.y);
  expect(visibleWord!.y + visibleWord!.height).toBeLessThanOrEqual(
    paperBounds!.y + paperBounds!.height,
  );
  await page.screenshot({
    path: info.outputPath("manifest-word-reader.png"),
    fullPage: true,
  });
  // Verify every private, explicitly marked source-page word join without
  // embedding book excerpts in the public test source.
  for (const [chapterIndex, chapter] of actual.chapters.entries()) {
    const joins = chapter.segments.flatMap((segment: any, i: number) =>
      segment.continuesPreviousWord ? [i] : [],
    );
    if (!joins.length) continue;
    const menu = page.getByRole("button", { name: "Open library menu" });
    if (await menu.isVisible()) await menu.click();
    await page
      .getByRole("navigation", { name: "Book chapters" })
      .getByRole("button")
      .nth(chapterIndex)
      .click();
    for (const i of joins) {
      const segment = chapter.segments[i];
      const cue = segment.words?.[0];
      const time = cue ? (cue.start + cue.end) / 2 : segment.start + 0.1;
      await page
        .getByLabel("Chapter playback position")
        .fill(String(Math.round(time * 10) / 10));
      const word =
        chapter.segments[i - 1].text.match(/\S+$/)[0] +
        segment.text.match(/^\S+/)[0];
      const continuation = page.locator(
        `[data-fragment][data-segment="${i}"][data-start="0"]`,
      );
      await expect(continuation).toBeVisible();
      await expect(continuation.locator("..")).toContainText(word);
    }
  }
  for (const n of [10, 19]) {
    const menu = page.getByRole("button", { name: "Open library menu" });
    if (await menu.isVisible()) await menu.click();
    await page.screenshot({
      path: info.outputPath(`manifest-drawer-${n}.png`),
      fullPage: true,
    });
    await page
      .getByRole("navigation", { name: "Book chapters" })
      .getByRole("button")
      .nth(n - 1)
      .click();
    await expect(page.locator(".ebook-heading")).toContainText(
      `Chapter ${n} of 19`,
    );
    await expect(
      page.getByRole("article", { name: "Book text" }),
    ).not.toBeEmpty();
  }
  await page.screenshot({
    path: info.outputPath("manifest-ending.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Original PDF", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".pdf-loading")).toHaveCount(0);
  await expect
    .poll(() =>
      page.locator("canvas").evaluate((c: HTMLCanvasElement) => c.width),
    )
    .toBeGreaterThan(50);
  const ink = await page.locator("canvas").evaluate((c: HTMLCanvasElement) => {
    const p = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < p.length; i += 64)
      if (p[i + 3] > 0 && Math.min(p[i], p[i + 1], p[i + 2]) < 240) n++;
    return n;
  });
  expect(ink).toBeGreaterThan(10);
  await page
    .getByLabel("PDF edition")
    .selectOption({ label: "Cozy interactive PDF" });
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".pdf-loading")).toHaveCount(0);
  await expect
    .poll(() =>
      page.locator("canvas").evaluate((c: HTMLCanvasElement) => c.width),
    )
    .toBeGreaterThan(50);
  const cozyInk = await page
    .locator("canvas")
    .evaluate((c: HTMLCanvasElement) => {
      const p = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < p.length; i += 64)
        if (p[i + 3] > 0 && Math.min(p[i], p[i + 1], p[i + 2]) < 240) n++;
      return n;
    });
  expect(cozyInk).toBeGreaterThan(10);
  await page.screenshot({
    path: info.outputPath("manifest-cozy-pdf.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("complete Piper edition plays for guests and preserves Kokoro", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.locator(".featured-book")).toHaveCount(2);
  await expect(page.locator(".secondary-book")).toContainText("Piper");
  await page.getByRole("button", { name: "Open book", exact: true }).first().click();
  await page.getByRole("button", { name: "Choose narration voice" }).click();
  await page.getByRole("button", { name: /Piper · Cori/ }).click();
  await expect(page.locator(".ebook-heading")).toContainText("Chapter 1 of 17");
  const book = await (await page.request.get("/books/manifest/piper/book.json")).json();
  expect(book.id).toBe("manifest-piper");
  expect(book.chapters.flatMap((c: any) => c.segments)).toHaveLength(715);
  expect(book.chapters.flatMap((c: any) => c.segments).some((s: any) => s.words)).toBe(false);
  expect(book.duration).toBeGreaterThan(12390);
  const range = await page.request.get(book.chapters[0].audio, { headers: { Range: "bytes=0-1023" } });
  expect(range.status()).toBe(206);
  expect((await range.body()).length).toBe(1024);
  await page.getByRole("button", { name: "Play narration", exact: true }).click();
  await expect.poll(async () => Number(await page.getByLabel("Chapter playback position").inputValue())).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause narration", exact: true }).click();
  await page.screenshot({ path: info.outputPath("piper-real-reading.png"), fullPage: true });
  await page.getByRole("button", { name: "Choose narration voice" }).click();
  await expect(page.getByRole("button", { name: /Piper · Cori/ })).toContainText("Selected");
  await page.getByRole("button", { name: /Kokoro · Emma/ }).click();
  await expect(page.locator(".ebook-heading")).toContainText("Chapter 5 of 19");
  expect(errors).toEqual([]);
});

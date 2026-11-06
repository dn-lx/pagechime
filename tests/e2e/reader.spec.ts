import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resolve } from "node:path";
test.beforeEach(async ({ page }) => {
  const user = await (await page.request.post("/__test/account")).json();
  const response = await page.request.post("/api/reader/login", {
    headers: { Origin: "http://localhost:4174" },
    data: { username: user.username, password: user.password },
  });
  expect(response.ok()).toBe(true);
});
async function open(page: any) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open book", exact: true }).click();
  await expect(page.getByRole("article", { name: "Book text" })).toContainText(
    "A quiet beginning.",
  );
}
async function menu(page: any) {
  const b = page.getByRole("button", { name: "Open library menu" });
  if (await b.isVisible()) await b.click();
}
test("one shelf card plays Kokoro by default and Piper remains selectable", async ({
  page,
  context,
}, info) => {
  await context.addCookies([
    {
      name: "reader-test-corpus",
      value: "voices",
      url: "http://localhost:4174",
    },
    { name: "reader-test-shelf", value: "piper", url: "http://localhost:4174" },
  ]);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".featured-book")).toHaveCount(1);
  await expect(page.locator(".voice-note")).toContainText("Kokoro · Emma");
  await expect(page.locator(".section-heading")).toContainText("1 book");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("single-book-shelf.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Listen to A Quiet Beginning" }).click();
  await expect(page.locator(".ebook-heading")).toContainText(
    "A quiet beginning",
  );
  await expect(page.getByRole("button", { name: "Pause narration", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause narration", exact: true }).click();
  await page.getByRole("button", { name: "Choose narration voice" }).click();
  await expect(page.getByRole("button", { name: /Kokoro · Emma/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Piper · Cori/ }).click();
  await expect(page.locator(".ebook-heading")).toContainText("Piper reading");
  await page.getByRole("button", { name: "Choose narration voice" }).click();
  await page.getByRole("button", { name: /Kokoro · Emma/ }).click();
  await expect(page.locator(".ebook-heading")).toContainText("A quiet beginning");
  await context.addCookies([
    { name: "reader-test-piper-unavailable", value: "1", url: "http://localhost:4174" },
  ]);
  await page.reload();
  await expect(page.locator(".featured-book")).toHaveCount(1);
  await expect(page.locator(".voice-note")).toContainText("Kokoro");
  await context.addCookies([
    { name: "reader-test-piper-unavailable", value: "0", url: "http://localhost:4174" },
    { name: "reader-test-kokoro-unavailable", value: "1", url: "http://localhost:4174" },
  ]);
  await page.reload();
  await expect(page.locator(".featured-book")).toHaveCount(1);
  await expect(page.locator(".voice-note")).toHaveText("Piper · Cori");
  await page.getByRole("button", { name: "Continue reading", exact: true }).click();
  await expect(page.locator(".ebook-heading")).toContainText("Piper reading");
  await page.getByRole("button", { name: "Choose narration voice" }).click();
  await expect(page.getByRole("button", { name: /Kokoro · Emma/ })).toBeDisabled();
  expect(errors).toEqual([]);
});
test("continuing a saved Piper passage opens the matching place in Kokoro", async ({ page, context }) => {
  await context.addCookies([
    { name: "reader-test-corpus", value: "voices", url: "http://localhost:4174" },
    { name: "reader-test-shelf", value: "piper", url: "http://localhost:4174" },
  ]);
  await page.goto("/");
  await expect(page.locator(".voice-note")).toContainText("Kokoro");
  await page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem("leaf.reader.session")!).account.id;
    localStorage.setItem(`leaf.account.${id}.progress.demo-piper`, JSON.stringify({
      chapter: 0,
      time: 4,
      page: 2,
      reading: { chapter: 0, segment: 2, offset: 0 },
      updated: Date.now(),
    }));
  });
  await page.reload();
  await page.getByRole("button", { name: "Continue reading", exact: true }).click();
  await expect(page.locator(".ebook-heading")).toContainText("The next page");
  await page.getByRole("button", { name: "Choose narration voice" }).click();
  await expect(page.getByRole("button", { name: /Kokoro · Emma/ })).toHaveAttribute("aria-pressed", "true");
});
test("listen, follow passages, change chapter, bookmark and restore a reading place", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await page
    .getByRole("button", { name: "Play narration", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause narration", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.getByLabel("Chapter playback position").inputValue())
    .not.toBe("0");
  await page
    .getByRole("button", { name: "Pause narration", exact: true })
    .click();
  await page.getByLabel("Playback speed").selectOption("0.85");
  await page.getByRole("button", { name: "Next audio chapter" }).click();
  await expect(page.getByRole("article", { name: "Book text" })).toContainText(
    "The next page.",
  );
  await page.getByRole("button", { name: "Bookmark this moment" }).click();
  await expect(page.getByRole("status")).toContainText("bookmark");
  await page.reload();
  await page
    .getByRole("button", { name: "Continue reading", exact: true })
    .click();
  await expect(page.getByRole("article", { name: "Book text" })).toContainText(
    "The next page.",
  );
  await expect(page.getByLabel("Playback speed")).toHaveValue("0.85");
  await menu(page);
  await page.getByRole("button", { name: "Bookmarks", exact: true }).click();
  await expect(page.locator(".marks-list")).toContainText("Page 2");
  expect(errors).toEqual([]);
});
test("PDF, voice setup, theme and accessible layout", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".featured-book")).toHaveCSS("opacity", "1");
  const library = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(library.violations).toEqual([]);
  await open(page);
  await expect(page.locator(".reader-main")).toHaveCSS("opacity", "1");
  const light = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(light.violations).toEqual([]);
  await page.getByRole("button", { name: "Original PDF", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect
    .poll(() => page.locator("canvas").evaluate((c: any) => c.width))
    .toBeGreaterThan(50);
  await page.getByRole("button", { name: "Choose narration voice" }).click();
  await expect(page.getByRole("dialog")).toContainText("Kokoro");
  await expect(
    page.getByRole("button", { name: /Google Neural2/ }),
  ).toBeDisabled();
  await expect(page.getByRole("dialog")).toContainText("Not enabled");
  await page.screenshot({
    path: info.outputPath("narration-paused.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await menu(page);
  await page.getByRole("button", { name: "Use night theme" }).click();
  const scrim = page.getByRole("button", { name: "Close library menu" });
  if (await scrim.isVisible()) await scrim.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const a = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a.violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("reader.png"),
    fullPage: true,
  });
});
test("offline download survives reload and serves audio ranges", async ({
  page,
  context,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Save offline", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove offline copy", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Continue reading", exact: true })
    .click();
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Continue reading", exact: true })
    .click();
  const result = await page.evaluate(async () => {
    const r = await fetch("/books/demo/1.wav", {
      headers: { Range: "bytes=0-99" },
    });
    return { status: r.status, length: (await r.arrayBuffer()).byteLength };
  });
  expect(result).toEqual({ status: 206, length: 100 });
  await page
    .getByRole("button", { name: "Play narration", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause narration", exact: true }),
  ).toBeVisible();
});
test("imports a PDF and audio into persistent local storage", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".section-heading")
    .getByRole("button", { name: "Add a book" })
    .click();
  await page.getByLabel("Book title", { exact: true }).fill("My own book");
  await page
    .getByLabel("Book PDF", { exact: true })
    .setInputFiles(resolve("tests/fixtures/book.pdf"));
  await page
    .getByLabel("Narration audio files")
    .setInputFiles(resolve("tests/fixtures/audio.wav"));
  await page.getByRole("button", { name: "Add to my bookshelf" }).click();
  await expect(
    page.getByRole("heading", { name: "My own book" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "My own book" }),
  ).toBeVisible();
  await page
    .locator(".featured-book")
    .filter({ has: page.getByRole("heading", { name: "My own book" }) })
    .getByRole("button", { name: "Open book" })
    .click();
  await expect(page.locator("canvas")).toBeVisible();
});
test("imported manual pages remain available offline without a bundled book download", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .locator(".section-heading")
    .getByRole("button", { name: "Add a book" })
    .click();
  await page.getByLabel("Book title", { exact: true }).fill("Offline journal");
  await page
    .getByLabel("Book PDF", { exact: true })
    .setInputFiles(resolve("tests/fixtures/book.pdf"));
  await page
    .getByLabel("Narration audio files")
    .setInputFiles(resolve("tests/fixtures/audio.wav"));
  await page.getByRole("button", { name: "Add to my bookshelf" }).click();
  const card = page
    .locator(".featured-book")
    .filter({ has: page.getByRole("heading", { name: "Offline journal" }) });
  await card.getByRole("button", { name: "Open book" }).click();
  await page.getByRole("button", { name: "Next PDF page" }).click();
  await expect(page.getByLabel("PDF page number")).toHaveValue("2");
  await page.getByRole("button", { name: "Bookmark this moment" }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Offline journal" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue reading", exact: true })
    .click();
  await expect(page.getByLabel("PDF page number")).toHaveValue("2");
  await expect(page.locator("canvas")).toBeVisible();
});
test("chapter end advances narration", async ({ page }) => {
  await open(page);
  await page.getByLabel("Chapter playback position").fill("7.8");
  await page
    .getByRole("button", { name: "Play narration", exact: true })
    .click();
  await expect(page.getByRole("article", { name: "Book text" })).toContainText(
    "The next page.",
  );
  await page
    .getByRole("button", { name: "Pause narration", exact: true })
    .click();
});

test("Piper can play, switch chapter layouts and return to Kokoro", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.context().addCookies([{ name: "reader-test-corpus", value: "voices", url: "http://localhost:4174" }]);
  await open(page);
  await page.getByRole("button", { name: "Next audio chapter" }).click();
  await page.getByRole("button", { name: "Choose narration voice" }).click();
  await expect(page.getByRole("button", { name: /Piper · Cori/ })).toBeEnabled();
  await expect(
    page.getByRole("dialog", { name: "A voice to read with" }),
  ).toHaveCSS("opacity", "1");
  const voiceA11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(voiceA11y.violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("piper-voice-choice.png"), fullPage: true });
  await page.getByRole("button", { name: /Piper · Cori/ }).click();
  await expect(page.locator(".ebook-heading")).toContainText("Piper reading");
  await expect(page.getByLabel("Chapter playback position")).toHaveValue("4");
  await page.getByRole("button", { name: "Play narration", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause narration", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Choose narration voice" }).click();
  await expect(page.getByRole("button", { name: /Piper · Cori/ })).toContainText("Selected");
  await page.getByRole("button", { name: /Kokoro · Emma/ }).click();
  await expect(page.locator(".ebook-heading")).toContainText("The next page");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

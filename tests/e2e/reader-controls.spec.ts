import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function enter(page: import("@playwright/test").Page) {
  const u = await (await page.request.post("/__test/account")).json();
  await page.request.post("/api/reader/login", {
    headers: { Origin: "http://localhost:4174" },
    data: { username: u.username, password: u.password },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open book", exact: true }).click();
}
test("real fullscreen keeps reader/player available and exits with browser state", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  const api = await page.evaluate(() => document.fullscreenEnabled);
  if (info.project.name === "desktop") expect(api).toBe(true);
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect(page.locator("body")).toHaveClass(/focus-reading/);
  if (api)
    await expect
      .poll(() =>
        page.evaluate(
          () => document.fullscreenElement === document.documentElement,
        ),
      )
      .toBe(true);
  await expect(
    page.getByRole("button", { name: "Exit fullscreen", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play narration", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article", { name: "Book text" })).toBeVisible();
  const navigation = await page
    .getByRole("navigation", { name: "Reading pages" })
    .boundingBox();
  const player = await page
    .getByRole("region", { name: "Audiobook player" })
    .boundingBox();
  expect(navigation!.y + navigation!.height).toBeLessThanOrEqual(player!.y);
  expect(
    await page
      .locator(".ebook-paper")
      .evaluate((e) => e.scrollHeight <= e.clientHeight + 2),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("fullscreen-reader.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Original PDF", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".pdf-loading")).toHaveCount(0);
  const pdfNavigation = await page
    .getByRole("navigation", { name: "PDF pages" })
    .boundingBox();
  expect(pdfNavigation!.y + pdfNavigation!.height).toBeLessThanOrEqual(
    player!.y,
  );
  await page.getByRole("button", { name: "Reading", exact: true }).click();
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await expect(page.locator("body")).not.toHaveClass(/focus-reading/);
  if (api) {
    await page
      .getByRole("button", { name: "Enter fullscreen", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(true);
    await page.evaluate(() => document.exitFullscreen());
    await expect(
      page.getByRole("button", { name: "Enter fullscreen", exact: true }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/focus-reading/);
  }
  expect(errors).toEqual([]);
});
test("fullscreen rejection uses an accessible full-window fallback and Escape restores chrome", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new DOMException("Unavailable", "NotAllowedError"));
  });
  await enter(page);
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect(page.locator("body")).toHaveClass(/focus-reading/);
  await expect(page.getByRole("status")).toContainText(
    "full-window reading view",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/focus-reading/);
  await expect(
    page.getByRole("button", { name: "Enter fullscreen", exact: true }),
  ).toBeVisible();
});
test("10-second controls are readable and seek correctly across chapter boundaries", async ({
  page,
}, info) => {
  await enter(page);
  const position = page.getByLabel("Chapter playback position");
  await position.fill("3");
  await page
    .getByRole("button", { name: "Forward 10 seconds", exact: true })
    .click();
  await expect(page.locator(".player-book")).toContainText("The next page");
  await expect(position).toHaveValue("5");
  await page
    .getByRole("button", { name: "Back 10 seconds", exact: true })
    .click();
  await expect(page.locator(".player-book")).toContainText("A quiet beginning");
  await expect(position).toHaveValue("3");
  for (const label of ["Back 10 seconds", "Forward 10 seconds"]) {
    const button = page.getByRole("button", { name: label, exact: true });
    await expect(button).toHaveText("10s");
    const size = await button.boundingBox();
    expect(size!.width).toBeGreaterThanOrEqual(44);
    expect(size!.height).toBeGreaterThanOrEqual(44);
    const icon = await button.locator("svg").boundingBox(),
      number = await button.locator("span").boundingBox();
    expect(number!.y).toBeGreaterThanOrEqual(icon!.y + icon!.height);
  }
  await page.screenshot({
    path: info.outputPath("reader-controls-mobile-desktop.png"),
    fullPage: true,
  });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  const menu = page.getByRole("button", {
    name: "Open library menu",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("button", { name: "Use night theme", exact: true })
    .click();
  const close = page.getByRole("button", {
    name: "Close library menu",
    exact: true,
  });
  if (await close.isVisible()) await close.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await page.screenshot({
    path: info.outputPath("reader-controls-night.png"),
    fullPage: true,
  });
  const night = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(night.violations).toEqual([]);
  if (info.project.name === "desktop") {
    const player = page.getByRole("region", { name: "Audiobook player" });
    const wide = (await player.boundingBox())!.height;
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(async () => (await player.boundingBox())!.height)
      .toBeGreaterThan(wide + 15);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect
      .poll(async () => (await player.boundingBox())!.height)
      .toBeLessThanOrEqual(wide + 1);
  }
});
test("normal start and automatic advance skip references while Contents retains direct access", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "reader-test-corpus",
      value: "references",
      url: "http://localhost:4174",
    },
  ]);
  await enter(page);
  await expect(page.locator(".ebook-heading")).toContainText("Chapter 2 of 5");
  await page.getByLabel("Chapter playback position").fill("7.7");
  await page
    .getByRole("button", { name: "Play narration", exact: true })
    .click();
  await expect(page.locator(".ebook-heading")).toContainText("Chapter 4 of 5");
  await page
    .getByRole("button", { name: "Pause narration", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Next audio chapter", exact: true }),
  ).toBeDisabled();
  const menu = page.getByRole("button", {
    name: "Open library menu",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  const contents = page.getByRole("navigation", { name: "Book chapters" });
  await expect(contents.getByRole("button")).toHaveCount(5);
  await contents.getByRole("button").first().click();
  await expect(page.locator(".ebook-heading")).toContainText("Chapter 1 of 5");
});

test("audio-only parts retain manual PDF pages across navigation, automatic advance and reload", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.context().addCookies([
    {
      name: "reader-test-corpus",
      value: "audioonly",
      url: "http://localhost:4174",
    },
  ]);
  await enter(page);
  const pdfPage = page.getByLabel("PDF page number");
  await expect(page.getByRole("button", { name: "Reading", exact: true })).toBeDisabled();
  await expect(page.locator("canvas")).toBeVisible();
  await pdfPage.fill("2");
  await page.getByRole("button", { name: "Next audio chapter", exact: true }).click();
  await expect(page.locator(".player-book")).toContainText("The next page");
  await expect(pdfPage).toHaveValue("2");
  await page.getByRole("button", { name: "Previous audio chapter", exact: true }).click();
  await expect(page.locator(".player-book")).toContainText("A quiet beginning");
  await expect(pdfPage).toHaveValue("2");
  await page.getByLabel("Chapter playback position").fill("7.7");
  await page.getByRole("button", { name: "Play narration", exact: true }).click();
  await expect(page.locator(".player-book")).toContainText("The next page");
  await page.getByRole("button", { name: "Pause narration", exact: true }).click();
  await expect(pdfPage).toHaveValue("2");
  await expect(page.getByRole("button", { name: "Follow audio", exact: true })).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "Continue reading", exact: true }).click();
  await expect(pdfPage).toHaveValue("2");
  await page.screenshot({ path: info.outputPath("audio-only-manual-pdf.png"), fullPage: true });
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { testPassword } from "../fixtures/reader-database";
test("admin publishes multiple PDFs and tracks, and a fresh reader sees the book without a rebuild", async ({
  page,
  browser,
}, info) => {
  const group = crypto.randomUUID();
  await page
    .context()
    .addCookies([
      {
        name: "reader-test-shared",
        value: group,
        url: "http://localhost:4174",
      },
    ]);
  await page.goto("/");
  await page.getByLabel("Username or email", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill(testPassword);
  await page
    .getByRole("button", { name: "Enter my library", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A Quiet Beginning", exact: true }),
  ).toBeVisible();
  const menu = page.getByRole("button", {
    name: "Open library menu",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("button", { name: "Publish a book", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Book title", { exact: true })
    .fill("The Shared Garden");
  await dialog
    .getByLabel("Author", { exact: true })
    .fill("PageChime Test Author");
  await dialog
    .getByLabel("Narrator or voice", { exact: true })
    .fill("Test narration");
  const pdf = await readFile("tests/fixtures/book.pdf"),
    longer = await readFile("tests/fixtures/book-three-pages.pdf"),
    audio = await readFile("tests/fixtures/audio.wav");
  await dialog.getByLabel("PDF editions", { exact: true }).setInputFiles([
    { name: "original.pdf", mimeType: "application/pdf", buffer: pdf },
    { name: "large-print.pdf", mimeType: "application/pdf", buffer: longer },
  ]);
  await dialog
    .getByRole("button", { name: "Make default", exact: true })
    .click();
  await dialog.getByLabel("Audio tracks", { exact: true }).setInputFiles([
    { name: "02-Ending.wav", mimeType: "audio/wav", buffer: audio },
    { name: "01-Opening.wav", mimeType: "audio/wav", buffer: audio },
  ]);
  await dialog
    .getByRole("button", { name: "Review book", exact: true })
    .click();
  await expect(
    dialog.getByRole("region", { name: "Publication review" }),
  ).toContainText("01 Opening → 02 Ending");
  await expect(
    dialog.getByRole("region", { name: "Publication review" }),
  ).toContainText("Default PDF: original · 2 pages");
  const before = await page.request.get("/api/library/catalog");
  expect((await before.json()).books).toEqual([]);
  expect(
    (
      await new AxeBuilder({ page })
        .include("dialog[open]")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("shared-upload-review.png"),
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Publish to shared library", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "The Shared Garden", exact: true }),
  ).toBeVisible();
  const fresh = await browser.newContext(info.project.use);
  try {
    await fresh.addCookies([
      {
        name: "reader-test-shared",
        value: group,
        url: "http://localhost:4174",
      },
    ]);
    const reader = await fresh.newPage();
    await reader.goto("/");
    await reader
      .getByRole("button", { name: "Continue as guest", exact: true })
      .click();
    const card = reader
      .locator("article")
      .filter({
        has: reader.getByRole("heading", {
          name: "The Shared Garden",
          exact: true,
        }),
      });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Open book", exact: true }).click();
    await expect(
      reader.getByLabel("PDF page number", { exact: true }),
    ).toHaveAttribute("max", "2");
    await reader
      .getByLabel("PDF edition", { exact: true })
      .selectOption({ label: "large-print" });
    await expect(
      reader.getByLabel("PDF page number", { exact: true }),
    ).toHaveAttribute("max", "3");
    await reader.getByLabel("PDF page number", { exact: true }).fill("3");
    await reader.getByLabel("PDF page number", { exact: true }).press("Tab");
    await reader
      .getByRole("button", { name: "Play narration", exact: true })
      .click();
    await expect(
      reader.getByRole("button", { name: "Pause narration", exact: true }),
    ).toBeVisible();
    await reader
      .getByRole("button", { name: "Next audio chapter", exact: true })
      .click();
    await expect(
      reader.getByLabel("PDF page number", { exact: true }),
    ).toHaveValue("3");
    await reader
      .getByLabel("PDF edition", { exact: true })
      .selectOption({ label: "original" });
    await expect(
      reader.getByLabel("PDF page number", { exact: true }),
    ).toHaveValue("2");
    const result = await reader.request.get("/api/library/catalog"),
      published = (await result.json()).books[0];
    const range = await reader.request.get(published.chapters[1].audio, {
      headers: { Range: "bytes=0-31" },
    });
    expect(range.status()).toBe(206);
    expect((await range.body()).length).toBe(32);
    const notAdmin = await reader.request.post("/api/library/admin/prepare", {
      data: {},
      headers: { Origin: "http://localhost:4174" },
    });
    expect(notAdmin.status()).toBe(401);
    await expect(reader.locator(".pdf-host canvas")).toBeVisible();
    await expect(reader.locator(".pdf-loading")).toHaveCount(0);
    expect(
      await reader.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await reader.screenshot({
      path: info.outputPath("shared-book-reader.png"),
      fullPage: true,
    });
  } finally {
    await fresh.close();
  }
});
